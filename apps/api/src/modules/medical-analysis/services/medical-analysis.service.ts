import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { RetrievalService } from '@modules/rag/services';
import type { IMedicalAnalysisService, AnalyzeOptions } from '../interfaces';
import type { MedicalAnalysisRequest, MedicalAnalysisResult } from '../types';
import {
  ANALYSIS_JOB_STEPS,
  ANALYSIS_JOB_STEP_LABELS,
} from '../jobs/medical-analysis-job.constants';
import type { AnalysisJobStep } from '../jobs/medical-analysis-job.constants';
import { MedicalQueryBuilder, AnalysisPromptBuilder } from '../builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from '../validators';
import { ReportEnrichmentService } from './report-enrichment.service';
import { parseMedicalAnalysisJson, AnalysisResponseParseError } from '../utils';
import { AnalysisSafetyException } from '../exceptions';
import type { MedicalAnalysisLlmOutput } from '../types';
import type { LlmCompletionResponse } from '@ai/types';

/**
 * Single entry point for AI medical causation analysis.
 * MUST use RAG retrieval — never bypasses the knowledge base.
 */
@Injectable()
export class MedicalAnalysisService implements IMedicalAnalysisService {
  private readonly logger = new Logger(MedicalAnalysisService.name);
  private static readonly MAX_COMPLETION_ATTEMPTS = 3;
  private static readonly JSON_RETRY_INSTRUCTION =
    '\n\nCORRECTION: Your previous response was not valid JSON. Return ONLY a single raw JSON object matching the schema. Do not include markdown fences, explanations, or reasoning tags.';

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly aiService: AiService,
    private readonly queryBuilder: MedicalQueryBuilder,
    private readonly promptBuilder: AnalysisPromptBuilder,
    private readonly safetyValidator: AnalysisSafetyValidator,
    private readonly responseMapper: AnalysisResponseMapper,
    private readonly reportEnrichment: ReportEnrichmentService,
  ) {}

  async analyze(
    request: MedicalAnalysisRequest,
    options?: AnalyzeOptions,
  ): Promise<MedicalAnalysisResult> {
    const analysisStart = Date.now();
    const report = async (
      step: AnalysisJobStep,
      progress: number,
      message: string,
    ): Promise<void> => {
      await options?.onProgress?.({
        step,
        stepLabel: ANALYSIS_JOB_STEP_LABELS[step],
        progress,
        message,
      });
    };

    this.logger.log(
      `Starting medical analysis for question: "${request.medicalQuestion.slice(0, 80)}..."`,
    );

    await report(
      ANALYSIS_JOB_STEPS.INTAKE,
      12,
      'Preparing medical case…',
    );

    const retrievalRequest = this.queryBuilder.buildRetrievalRequest(request);

    await report(
      ANALYSIS_JOB_STEPS.PRIVATE_KB,
      28,
      'Searching private knowledge base…',
    );

    const retrieval = await this.retrievalService.retrieve(retrievalRequest);

    this.safetyValidator.validateRetrievalHasContext(retrieval);

    await report(
      ANALYSIS_JOB_STEPS.EVIDENCE,
      45,
      'Ranking medical sources and building context…',
    );

    const builtPrompts = await this.promptBuilder.build(request, retrieval);
    const citationMap = new Map(
      builtPrompts.citationCatalog.map((c) => [c.chunkId, c]),
    );
    const allowedChunkIds = new Set(builtPrompts.allowedChunkIds);

    await report(
      ANALYSIS_JOB_STEPS.REASONING,
      62,
      'Analyzing medical literature with AI…',
    );

    const llmResult = await this.completeWithCitationValidation({
      systemPrompt: builtPrompts.systemPrompt,
      userPrompt: builtPrompts.userPrompt,
      allowedChunkIds,
      citationMap,
    });

    await report(
      ANALYSIS_JOB_STEPS.SUMMARY,
      82,
      'Generating statistical summary and citations…',
    );

    const result = this.reportEnrichment.enrich(
      this.responseMapper.mapToResult({
        request,
        llmOutput: llmResult.llmOutput,
        citationMap,
        retrieval,
        analysisExecutionTimeMs: Date.now() - analysisStart,
        llmProvider: llmResult.llmResponse.provider,
        llmModel: llmResult.llmResponse.model,
      }),
      request,
    );

    await report(
      ANALYSIS_JOB_STEPS.REPORT,
      95,
      'Finalizing professional report…',
    );

    this.logger.log(
      `Analysis complete: confidence=${result.confidenceScore.score}, ` +
        `chunks=${result.metadata.chunkCount}, citations=${result.citations.length}`,
    );

    return result;
  }

  private async completeWithCitationValidation(params: {
    systemPrompt: string;
    userPrompt: string;
    allowedChunkIds: Set<string>;
    citationMap: Map<string, import('../types').AnalysisCitation>;
  }): Promise<{
    llmOutput: MedicalAnalysisLlmOutput;
    llmResponse: LlmCompletionResponse;
  }> {
    let userPrompt = params.userPrompt;

    for (let attempt = 0; attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS; attempt++) {
      const llmResponse = await this.aiService.complete({
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        metadata: { responseFormat: 'json' },
        temperature: 0.2,
      });

      if (!llmResponse.content?.trim()) {
        if (attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS - 1) {
          this.logger.warn(
            `Empty LLM response on attempt ${attempt + 1}, retrying`,
          );
          userPrompt += MedicalAnalysisService.JSON_RETRY_INSTRUCTION;
          continue;
        }
        throw new AnalysisResponseParseError('LLM returned an empty response');
      }

      let llmOutput: MedicalAnalysisLlmOutput;
      try {
        llmOutput = parseMedicalAnalysisJson(llmResponse.content);
      } catch (error) {
        if (
          attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS - 1 &&
          error instanceof AnalysisResponseParseError
        ) {
          this.logger.warn(
            `JSON parse failed on attempt ${attempt + 1}: ${error.message}`,
          );
          userPrompt += MedicalAnalysisService.JSON_RETRY_INSTRUCTION;
          continue;
        }
        throw error;
      }

      try {
        this.safetyValidator.validateCitations(
          llmOutput,
          params.allowedChunkIds,
          params.citationMap,
        );
        return { llmOutput, llmResponse };
      } catch (error) {
        if (
          attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS - 1 &&
          error instanceof AnalysisSafetyException &&
          error.message.includes('chunkId')
        ) {
          this.logger.warn(
            'Citation validation failed — retrying with corrected chunkId constraints',
          );
          userPrompt +=
            '\n\nCORRECTION: Your previous response referenced invalid chunkIds. Return corrected JSON using ONLY these exact chunkIds:\n' +
            [...params.allowedChunkIds].join('\n');
          continue;
        }
        throw error;
      }
    }

    throw new AnalysisSafetyException(
      'Unable to produce citation-valid analysis after retry',
    );
  }
}
