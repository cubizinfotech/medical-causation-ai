import { Injectable, Logger } from '@nestjs/common';
import { ExpertResearchService } from '@integrations/expert-research';
import { EwiWordReportService } from '../../report/ewi-word-report.service';
import { EwiAnalysisService } from '../analysis/ewi-analysis.service';
import type {
  EwiInvestigationRequest,
  EwiProgressUpdate,
} from '../jobs/ewi-investigation-job.types';
import {
  executeInvestigationWorkflow,
  type InvestigationWorkflowOutcome,
} from '../workflow/investigation-workflow';

export interface InvestigateOptions {
  onProgress?: (update: EwiProgressUpdate) => void | Promise<void>;
}

@Injectable()
export class ExpertInvestigationService {
  private readonly logger = new Logger(ExpertInvestigationService.name);

  constructor(
    private readonly research: ExpertResearchService,
    private readonly reportService: EwiWordReportService,
    private readonly analysis: EwiAnalysisService,
  ) {}

  investigate(
    request: EwiInvestigationRequest,
    options: InvestigateOptions = {},
  ): Promise<InvestigationWorkflowOutcome> {
    return executeInvestigationWorkflow(request, {
      research: this.research,
      report: this.reportService,
      analyze: (packet) => this.analysis.interpret(packet),
      onProgress: options.onProgress,
      logger: this.logger,
    });
  }
}
