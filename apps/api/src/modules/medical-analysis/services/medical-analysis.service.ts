import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { RetrievalService } from '@modules/rag/services';
import type { IMedicalAnalysisService } from '../interfaces';
import type { MedicalAnalysisRequest, MedicalAnalysisResult } from '../types';
import { MedicalQueryBuilder, AnalysisPromptBuilder } from '../builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from '../validators';
import { parseMedicalAnalysisJson } from '../utils';
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

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly aiService: AiService,
    private readonly queryBuilder: MedicalQueryBuilder,
    private readonly promptBuilder: AnalysisPromptBuilder,
    private readonly safetyValidator: AnalysisSafetyValidator,
    private readonly responseMapper: AnalysisResponseMapper,
  ) {}

  async analyze(
    request: MedicalAnalysisRequest,
  ): Promise<MedicalAnalysisResult> {
    const analysisStart = Date.now();

    this.logger.log(
      `Starting medical analysis for question: "${request.medicalQuestion.slice(0, 80)}..."`,
    );

    const retrievalRequest = this.queryBuilder.buildRetrievalRequest(request);
    const retrieval = await this.retrievalService.retrieve(retrievalRequest);

    this.safetyValidator.validateRetrievalHasContext(retrieval);

    const builtPrompts = await this.promptBuilder.build(request, retrieval);
    const citationMap = new Map(
      builtPrompts.citationCatalog.map((c) => [c.chunkId, c]),
    );
    const allowedChunkIds = new Set(builtPrompts.allowedChunkIds);

    const llmResult = await this.completeWithCitationValidation({
      systemPrompt: builtPrompts.systemPrompt,
      userPrompt: builtPrompts.userPrompt,
      allowedChunkIds,
      citationMap,
    });

    const result = this.responseMapper.mapToResult({
      request,
      llmOutput: llmResult.llmOutput,
      citationMap,
      retrieval,
      analysisExecutionTimeMs: Date.now() - analysisStart,
      llmProvider: llmResult.llmResponse.provider,
      llmModel: llmResult.llmResponse.model,
    });

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

    for (let attempt = 0; attempt < 2; attempt++) {
      const llmResponse = await this.aiService.complete({
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        metadata: { responseFormat: 'json' },
        temperature: 0.2,
      });

      const llmOutput = parseMedicalAnalysisJson(llmResponse.content);

      try {
        this.safetyValidator.validateCitations(
          llmOutput,
          params.allowedChunkIds,
          params.citationMap,
        );
        return { llmOutput, llmResponse };
      } catch (error) {
        if (
          attempt === 0 &&
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
