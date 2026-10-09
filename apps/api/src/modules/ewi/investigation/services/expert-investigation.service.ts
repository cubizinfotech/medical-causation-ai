import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpertResearchService } from '@integrations/expert-research';
import type { ResearchProviderSettings } from '@config/config.types';
import { EwiWordReportService } from '../../report/ewi-word-report.service';
import { EwiAnalysisService } from '../analysis/ewi-analysis.service';
import { ExpertCvService } from '../../cv/expert-cv.service';
import type {
  EwiInvestigationRequest,
  EwiProgressUpdate,
} from '../jobs/ewi-investigation-job.types';
import {
  executeInvestigationWorkflow,
  InvestigationCancelledError,
  type InvestigationWorkflowCheckpoint,
  type InvestigationWorkflowOutcome,
} from '../workflow/investigation-workflow';
import { PublicResearchCache } from '../workflow/research-cache';
import { ExpertInvestigationRepository } from '../repositories/expert-investigation.repository';

export interface InvestigateOptions {
  jobId?: string;
  onProgress?: (update: EwiProgressUpdate) => void | Promise<void>;
  onCheckpoint?: (
    checkpoint: InvestigationWorkflowCheckpoint,
  ) => void | Promise<void>;
  shouldContinue?: () => boolean | Promise<boolean>;
  checkpoint?: InvestigationWorkflowCheckpoint;
}

@Injectable()
export class ExpertInvestigationService {
  private readonly logger = new Logger(ExpertInvestigationService.name);
  private readonly researchCache: PublicResearchCache;

  constructor(
    private readonly research: ExpertResearchService,
    private readonly reportService: EwiWordReportService,
    private readonly analysis: EwiAnalysisService,
    private readonly config: ConfigService,
    private readonly investigations: ExpertInvestigationRepository,
    private readonly cv: ExpertCvService,
  ) {
    const settings = this.config.get<ResearchProviderSettings>('research');
    const ttlSeconds = Number(process.env.RESEARCH_CACHE_TTL_SECONDS ?? 300);
    this.researchCache = new PublicResearchCache(
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 0,
    );
    void settings;
  }

  investigate(
    request: EwiInvestigationRequest,
    options: InvestigateOptions = {},
  ): Promise<InvestigationWorkflowOutcome> {
    const researchSettings =
      this.config.get<ResearchProviderSettings>('research');
    return executeInvestigationWorkflow(request, {
      research: this.research,
      report: this.reportService,
      analyze: (packet) => this.analysis.interpret(packet),
      readChallengeRulings: (input) =>
        this.analysis.readChallengeRulings(input),
      readCv: (documentId, onProgress) =>
        this.cv.extract(documentId, request.expertName, onProgress),
      onProgress: options.onProgress,
      onCheckpoint: options.onCheckpoint,
      shouldContinue:
        options.shouldContinue ??
        (options.jobId
          ? () => this.isJobStillActive(options.jobId!)
          : undefined),
      checkpoint: options.checkpoint,
      researchCache: this.researchCache,
      logger: this.logger,
      maxAttempts: researchSettings?.retryMaxAttempts ?? 3,
      retryDelayMs: researchSettings?.retryDelayMs ?? 1000,
    });
  }

  private async isJobStillActive(jobId: string): Promise<boolean> {
    const row = await this.investigations.findByJobId(jobId);
    if (!row) return true;
    return row.status !== 'cancelled' && row.status !== 'failed';
  }
}

export { InvestigationCancelledError };
