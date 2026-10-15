import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import {
  BACKGROUND_RATE_LIMIT_RETRY,
  describeError,
  retryOnRateLimit,
} from '@ai/utils';
import { RetrievalService } from '@modules/rag/services';
import type { RetrievalRequest, RetrievalResult } from '@modules/rag/types';
import type { IMedicalAnalysisService, AnalyzeOptions } from '../interfaces';
import type {
  AnalysisPromptMode,
  MedicalAnalysisRequest,
  MedicalAnalysisResult,
  MedicalChronology,
  MedicalSpecials,
} from '../types';
import { ANALYSIS_MAX_OUTPUT_TOKENS } from '../constants';
import {
  buildEvidenceBasis,
  capUncitedConfidence,
  libraryIsSufficient,
} from './evidence-basis.helpers';
import type { CaseLiteratureResult } from './case-literature.service';
import type { LoadedCaseRecord } from '../records/case-record.types';
import { findDefenseIssues } from '../records/defense-issues';
import {
  ANALYSIS_JOB_STEPS,
  ANALYSIS_JOB_STEP_LABELS,
} from '../jobs/medical-analysis-job.constants';
import type { AnalysisJobStep } from '../jobs/medical-analysis-job.constants';
import { MedicalQueryBuilder, AnalysisPromptBuilder } from '../builders';
import {
  AnalysisResponseMapper,
  AnalysisSafetyValidator,
  verifiedReferencesFrom,
} from '../validators';
import { ReportEnrichmentService } from './report-enrichment.service';
import { CaseLiteratureService } from './case-literature.service';
import { CaseRecordsService } from '../records/case-records.service';
import { ChronologyExtractionService } from '../records/chronology-extraction.service';
import { BillingExtractionService } from '../records/billing-extraction.service';
import { parseMedicalAnalysisJson, AnalysisResponseParseError } from '../utils';
import { AnalysisSafetyException } from '../exceptions';
import type { MedicalAnalysisLlmOutput } from '../types';
import type { LlmCompletionResponse } from '@ai/types';

/**
 * Single entry point for AI medical causation analysis.
 * Always searches the firm library first. When it has too little relevant
 * material, the analysis is supplemented with PubMed abstracts and labelled
 * general medical knowledge instead of failing.
 */
@Injectable()
export class MedicalAnalysisService implements IMedicalAnalysisService {
  private readonly logger = new Logger(MedicalAnalysisService.name);
  private static readonly MAX_COMPLETION_ATTEMPTS = 3;
  private static readonly JSON_RETRY_INSTRUCTION =
    '\n\nCORRECTION: Your previous response was not valid JSON. Return ONLY a single raw JSON object matching the schema. Do not include markdown fences, explanations, or reasoning tags.';
  private static readonly TRUNCATED_RETRY_INSTRUCTION =
    '\n\nCORRECTION: Your previous response was cut off because it was too long. Return the same JSON schema, shorter: at most 6 items in each evidence list, excerpts under 30 words, reasoning under 50 words per item, and aiReasoning under 250 words.';

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
    private readonly billingExtraction: BillingExtractionService,
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

    // Case details stay out of the logs.
    this.logger.log(
      `Starting medical analysis (${request.recordIds?.length ?? 0} record(s) attached)`,
    );

    await report(ANALYSIS_JOB_STEPS.INTAKE, 10, 'Preparing medical case…');

    const { chronology, records } = await this.buildChronology(
      request,
      options?.caseId,
      report,
    );
    const medicalSpecials = await this.readBills(records, chronology, report);
    // "Bad facts" the defense may raise: fixed rules over the records and
    // intake, so the analysis can address them and the report lists them.
    const defenseIssues = findDefenseIssues({ request, chronology, records });

    const retrievalRequest = this.queryBuilder.buildRetrievalRequest(request);

    await report(
      ANALYSIS_JOB_STEPS.PRIVATE_KB,
      38,
      'Searching private knowledge base…',
    );

    const retrieval = await this.retrieveLibrary(retrievalRequest);
    const promptMode: AnalysisPromptMode = libraryIsSufficient(retrieval)
      ? 'library'
      : 'supplemented';

    // Too little in the library: look for published studies before the AI
    // call, so their abstracts can be cited. Never throws.
    let prefetchedLiterature: CaseLiteratureResult | undefined;
    if (promptMode === 'supplemented') {
      this.logger.log(
        `Library coverage is limited (${retrieval.coverage?.relevantChunkCount ?? 0} relevant passage(s), search=${retrieval.coverage?.searchMode ?? 'hybrid'}); supplementing the analysis`,
      );
      await report(
        ANALYSIS_JOB_STEPS.PUBLIC_LIT,
        41,
        'Few matching library sources — searching published studies (PubMed)…',
      );
      prefetchedLiterature = await this.caseLiterature.research(
        request,
        await this.caseLiterature.suggestSearch(request),
      );
    }

    await report(
      ANALYSIS_JOB_STEPS.EVIDENCE,
      45,
      promptMode === 'library'
        ? 'Ranking medical sources and building context…'
        : 'Combining library sources, published studies, and case records…',
    );

    const builtPrompts = await this.promptBuilder.build(
      request,
      retrieval,
      chronology,
      this.caseRecords.chronologySettings.chronologyPromptChars,
      defenseIssues,
      { mode: promptMode, literature: prefetchedLiterature?.references },
    );
    const citationMap = new Map(
      builtPrompts.citationCatalog.map((c) => [c.chunkId, c]),
    );
    const allowedChunkIds = new Set(builtPrompts.allowedChunkIds);

    await report(
      ANALYSIS_JOB_STEPS.REASONING,
      62,
      'Analyzing the medical evidence with AI…',
    );

    const llmResult = await this.completeWithCitationValidation({
      systemPrompt: builtPrompts.systemPrompt,
      userPrompt: builtPrompts.userPrompt,
      allowedChunkIds,
      citationMap,
    });
    // Links, PMIDs, and DOIs the model wrote that are not among the sources
    // it was given are removed before anything is saved.
    const scrubbed = this.safetyValidator.scrubFreeText(
      llmResult.llmOutput,
      verifiedReferencesFrom(builtPrompts.citationCatalog),
    );
    if (scrubbed.removed > 0) {
      this.logger.warn(
        `Removed ${scrubbed.removed} unverified link(s) or identifier(s) from the analysis text`,
      );
    }

    // Uses the search terms the analysis just suggested. Never throws: a
    // failed search is reported in the result, not as a failed analysis.
    let literature = prefetchedLiterature;
    if (!literature) {
      await report(
        ANALYSIS_JOB_STEPS.PUBLIC_LIT,
        74,
        'Searching public medical literature (PubMed)…',
      );
      literature = await this.caseLiterature.research(
        request,
        scrubbed.output.literatureSearch,
      );
    }

    await report(
      ANALYSIS_JOB_STEPS.SUMMARY,
      82,
      'Generating statistical summary and citations…',
    );

    const mapped = this.responseMapper.mapToResult({
      request,
      llmOutput: scrubbed.output,
      citationMap,
      retrieval,
      analysisExecutionTimeMs: Date.now() - analysisStart,
      llmProvider: llmResult.llmResponse.provider,
      llmModel: llmResult.llmResponse.model,
    });
    const evidenceBasis = buildEvidenceBasis({
      promptMode,
      retrieval,
      offered: builtPrompts.offered ?? {
        libraryPassages: retrieval.chunks.length,
        literatureArticles: 0,
        recordEntries: 0,
      },
      result: mapped,
      literature: literature.summary,
    });

    const capped = capUncitedConfidence(mapped, evidenceBasis);
    const result = this.reportEnrichment.enrich(
      {
        ...capped,
        evidenceBasis,
        // Passages the analysis was given, not every passage searched.
        metadata: {
          ...capped.metadata,
          chunkCount: evidenceBasis.knowledgeBasePassages,
        },
      },
      request,
      literature,
      chronology,
      defenseIssues,
      medicalSpecials,
    );

    await report(
      ANALYSIS_JOB_STEPS.REPORT,
      95,
      'Finalizing professional report…',
    );

    this.logger.log(
      `Analysis complete: basis=${evidenceBasis.mode}, confidence=${result.confidenceScore.score}, ` +
        `chunks=${result.metadata.chunkCount}, citations=${result.citations.length}`,
    );

    return result;
  }

  /**
   * Searches the firm library. A failed search (database or embedding
   * problem) is treated as an empty result: the analysis continues with
   * other sources rather than failing.
   */
  private async retrieveLibrary(
    retrievalRequest: RetrievalRequest,
  ): Promise<RetrievalResult> {
    try {
      return await this.retrievalService.retrieve(retrievalRequest);
    } catch (error) {
      this.logger.warn(
        `Library search failed; continuing without library passages: ${describeError(error)}`,
      );
      return {
        question: retrievalRequest.question,
        chunks: [],
        context: {
          contextText: '',
          citations: [],
          chunkCount: 0,
          estimatedTokens: 0,
          truncated: false,
        },
        executionTimeMs: 0,
        embeddingProvider: 'none',
        embeddingModel: 'none',
        strategy: 'hybrid',
        reranker: 'none',
        coverage: {
          searchMode: 'keyword_only',
          vectorSkipReason: 'embedding_failed',
          relevantChunkCount: 0,
          topSimilarity: 0,
          relevanceThreshold: 0,
          sufficient: false,
        },
      };
    }
  }

  /** Reads uploaded records into a cited chronology (steps 15–34%). */
  private async buildChronology(
    request: MedicalAnalysisRequest,
    caseId: string | undefined,
    report: (
      step: AnalysisJobStep,
      progress: number,
      message: string,
    ) => Promise<void>,
  ): Promise<{ chronology?: MedicalChronology; records: LoadedCaseRecord[] }> {
    // Records are read only through the case they are attached to.
    if (!request.recordIds?.length || !caseId) return { records: [] };

    await report(
      ANALYSIS_JOB_STEPS.RECORDS,
      14,
      'Reading uploaded medical records…',
    );
    const scanned = await this.caseRecords.readScannedPages(
      caseId,
      request.recordIds,
      (done, total) =>
        report(
          ANALYSIS_JOB_STEPS.RECORDS,
          14 + Math.round((done / total) * 2),
          `Reading scanned pages with OCR (${done} of ${total})…`,
        ),
    );
    if (scanned.attempted > 0) {
      this.logger.log(
        `OCR read ${scanned.read} of ${scanned.attempted} scanned page(s)`,
      );
    }
    const records = await this.caseRecords.loadForAnalysis(
      caseId,
      request.recordIds,
    );

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
      {
        lowConfidence: this.caseRecords.chronologySettings.ocrLowConfidence,
        error: scanned.error,
      },
    );
    this.logger.log(
      `Chronology: ${chronology.events.length} events from ${chronology.pagesProcessed} pages (${chronology.status})`,
    );
    return { chronology, records };
  }

  /** Reads the pages that look like bills into a cited ledger (34–37%). */
  private async readBills(
    records: LoadedCaseRecord[],
    chronology: MedicalChronology | undefined,
    report: (
      step: AnalysisJobStep,
      progress: number,
      message: string,
    ) => Promise<void>,
  ): Promise<MedicalSpecials | undefined> {
    if (records.length === 0) return undefined;
    await report(ANALYSIS_JOB_STEPS.CHRONOLOGY, 34, 'Reading medical bills…');
    const specials = await this.billingExtraction.build(
      records,
      chronology?.events ?? [],
      (done, total) =>
        report(
          ANALYSIS_JOB_STEPS.CHRONOLOGY,
          34 + Math.round((done / total) * 3),
          `Reading medical bills (${done} of ${total} sections)…`,
        ),
    );
    this.logger.log(
      `Bills: ${specials.charges.length} charges from ${specials.providers.length} providers (${specials.status})`,
    );
    return specials;
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
    // A retry sends the original prompt plus only the latest correction,
    // so it never costs more than the first attempt.
    let userPrompt = params.userPrompt;

    for (
      let attempt = 0;
      attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS;
      attempt++
    ) {
      const llmResponse = await retryOnRateLimit(
        () =>
          this.aiService.complete({
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            metadata: { responseFormat: 'json' },
            temperature: 0.2,
            maxTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
          }),
        BACKGROUND_RATE_LIMIT_RETRY,
      );
      // A cut-off answer is not fixed by sending the same prompt again.
      const truncated = /max_tokens|^length$/i.test(
        llmResponse.finishReason ?? '',
      );
      const correction = truncated
        ? MedicalAnalysisService.TRUNCATED_RETRY_INSTRUCTION
        : MedicalAnalysisService.JSON_RETRY_INSTRUCTION;

      if (!llmResponse.content?.trim()) {
        if (attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS - 1) {
          this.logger.warn(
            `Empty LLM response on attempt ${attempt + 1} (finish=${llmResponse.finishReason ?? 'unknown'}), retrying`,
          );
          userPrompt = params.userPrompt + correction;
          continue;
        }
        throw new AnalysisResponseParseError('LLM returned an empty response');
      }

      let llmOutput: MedicalAnalysisLlmOutput;
      try {
        llmOutput = parseMedicalAnalysisJson(llmResponse.content);
        // A report without its reasoning is incomplete, not a success.
        if (!llmOutput.aiReasoning?.trim()) {
          throw new AnalysisResponseParseError(
            'LLM response is missing aiReasoning',
          );
        }
      } catch (error) {
        if (
          attempt < MedicalAnalysisService.MAX_COMPLETION_ATTEMPTS - 1 &&
          error instanceof AnalysisResponseParseError
        ) {
          this.logger.warn(
            `JSON parse failed on attempt ${attempt + 1}${truncated ? ' (answer was cut off)' : ''}: ${error.message}`,
          );
          userPrompt = params.userPrompt + correction;
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
          userPrompt =
            params.userPrompt +
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
