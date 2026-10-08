import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { RetrievalService } from '@modules/rag/services';
import type { IMedicalAnalysisService, AnalyzeOptions } from '../interfaces';
import type {
  MedicalAnalysisRequest,
  MedicalAnalysisResult,
  MedicalChronology,
} from '../types';
import {
  ANALYSIS_JOB_STEPS,
  ANALYSIS_JOB_STEP_LABELS,
} from '../jobs/medical-analysis-job.constants';
import type { AnalysisJobStep } from '../jobs/medical-analysis-job.constants';
import { MedicalQueryBuilder, AnalysisPromptBuilder } from '../builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from '../validators';
import { ReportEnrichmentService } from './report-enrichment.service';
import { CaseLiteratureService } from './case-literature.service';
import { CaseRecordsService } from '../records/case-records.service';
import { ChronologyExtractionService } from '../records/chronology-extraction.service';
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
  private static readonly MAX_COMPLETION_ATTEMPTS = 5;
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
    private readonly caseLiterature: CaseLiteratureService,
    private readonly caseRecords: CaseRecordsService,
    private readonly chronologyExtraction: ChronologyExtractionService,
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

    await report(ANALYSIS_JOB_STEPS.INTAKE, 10, 'Preparing medical case…');

    const chronology = await this.buildChronology(request, report);

    const retrievalRequest = this.queryBuilder.buildRetrievalRequest(request);

    await report(
      ANALYSIS_JOB_STEPS.PRIVATE_KB,
      38,
      'Searching private knowledge base…',
    );

    const retrieval = await this.retrievalService.retrieve(retrievalRequest);

    this.safetyValidator.validateRetrievalHasContext(retrieval);

    await report(
      ANALYSIS_JOB_STEPS.EVIDENCE,
      45,
      'Ranking medical sources and building context…',
    );

    const builtPrompts = await this.promptBuilder.build(
      request,
      retrieval,
      chronology,
      this.caseRecords.chronologySettings.chronologyPromptChars,
    );
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

    // Uses the search terms the analysis just suggested. Never throws: a
    // failed search is reported in the result, not as a failed analysis.
    await report(
      ANALYSIS_JOB_STEPS.PUBLIC_LIT,
      74,
      'Searching public medical literature (PubMed)…',
    );
    const literature = await this.caseLiterature.research(
      request,
      llmResult.llmOutput.literatureSearch,
    );

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
      literature,
      chronology,
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

  /** Reads uploaded records into a cited chronology (steps 15–34%). */
  private async buildChronology(
    request: MedicalAnalysisRequest,
    report: (
      step: AnalysisJobStep,
      progress: number,
      message: string,
    ) => Promise<void>,
  ): Promise<MedicalChronology | undefined> {
    if (!request.recordIds?.length) return undefined;

    await report(
      ANALYSIS_JOB_STEPS.RECORDS,
      14,
      'Reading uploaded medical records…',
    );
    const records = await this.caseRecords.loadForAnalysis(request.recordIds);

    await report(
      ANALYSIS_JOB_STEPS.CHRONOLOGY,
      16,
      'Building the cited medical chronology…',
    );
    const chronology = await this.chronologyExtraction.build(
      records,
      this.caseRecords.chronologySettings.chronologyBatchChars,
      (done, total) =>
        report(
          ANALYSIS_JOB_STEPS.CHRONOLOGY,
          16 + Math.round((done / total) * 18),
          `Building the cited medical chronology (${done} of ${total} sections read)…`,
        ),
    );
    this.logger.log(
      `Chronology: ${chronology.events.length} events from ${chronology.pagesProcessed} pages (${chronology.status})`,
    );
    return chronology;
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

    for (
      let attempt = 0;
      attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS;
      attempt++
    ) {
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
        const sanitized = this.safetyValidator.removeUnknownCitations(
          llmOutput,
          params.allowedChunkIds,
        );
        if (sanitized.removedChunkIds.length > 0) {
          this.logger.warn(
            `Removed unknown citation chunkIds: ${sanitized.removedChunkIds.join(', ')}`,
          );
          llmOutput = sanitized.output;
        }

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
