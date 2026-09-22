import { Injectable, Logger } from '@nestjs/common';
import { ExpertResearchOrchestrator } from '../../research/expert-research.orchestrator';
import { CrossExamQuestionGenerator } from '../../research/cross-exam-question.generator';
import { EwiWordReportService } from '../../report/ewi-word-report.service';
import {
  EWI_JOB_STEP_LABELS,
  EWI_JOB_STEPS,
  type EwiJobStep,
} from '../jobs/ewi-investigation-job.constants';
import type {
  EwiInvestigationRequest,
  EwiInvestigationResult,
  EwiProgressUpdate,
} from '../jobs/ewi-investigation-job.types';

export interface InvestigateOptions {
  onProgress?: (update: EwiProgressUpdate) => void | Promise<void>;
}

export interface InvestigateOutcome {
  result: EwiInvestigationResult;
  report: { fileName: string; mimeType: string; buffer: Buffer };
}

@Injectable()
export class ExpertInvestigationService {
  private readonly logger = new Logger(ExpertInvestigationService.name);

  constructor(
    private readonly research: ExpertResearchOrchestrator,
    private readonly questions: CrossExamQuestionGenerator,
    private readonly reportService: EwiWordReportService,
  ) {}

  async investigate(
    request: EwiInvestigationRequest,
    options: InvestigateOptions = {},
  ): Promise<InvestigateOutcome> {
    const reportProgress = async (
      step: EwiJobStep,
      progress: number,
      message?: string,
    ) => {
      await options.onProgress?.({
        step,
        stepLabel: EWI_JOB_STEP_LABELS[step],
        progress,
        message,
      });
    };

    await reportProgress(EWI_JOB_STEPS.INTAKE, 5, 'Validating expert intake…');
    await reportProgress(EWI_JOB_STEPS.PROFILE, 15, 'Discovering profile…');
    await reportProgress(
      EWI_JOB_STEPS.CREDENTIALS,
      30,
      'Checking credentials…',
    );
    await reportProgress(
      EWI_JOB_STEPS.SCHOLARSHIP,
      45,
      'Searching scholarship…',
    );
    await reportProgress(EWI_JOB_STEPS.LEGAL, 55, 'Searching legal records…');
    await reportProgress(EWI_JOB_STEPS.PUBLIC_WEB, 65, 'Searching public web…');

    const bundle = await this.research.investigate(request);

    await reportProgress(
      EWI_JOB_STEPS.DISCREPANCY,
      75,
      `Analyzing discrepancies (${bundle.discrepancies.length})…`,
    );

    await reportProgress(
      EWI_JOB_STEPS.QUESTIONS,
      85,
      'Generating cross-examination questions…',
    );
    const questions = this.questions.generate({
      expertName: request.expertName,
      specialty: request.specialty,
      evidence: bundle.evidence,
      discrepancies: bundle.discrepancies,
    });

    const generatedAt = new Date().toISOString();
    await reportProgress(EWI_JOB_STEPS.REPORT, 95, 'Building Word report…');

    const report = await this.reportService.build({
      expertName: request.expertName,
      specialty: request.specialty,
      evidence: bundle.evidence,
      discrepancies: bundle.discrepancies,
      questions,
      generatedAt,
    });

    const result: EwiInvestigationResult = {
      expertName: request.expertName,
      specialty: request.specialty,
      evidence: bundle.evidence,
      discrepancies: bundle.discrepancies,
      questions,
      questionCount: questions.length,
      sourceStatuses: bundle.sourceResults.map((r) => ({
        sourceId: r.sourceId,
        status: r.status,
        message: r.message,
        itemCount: r.items.length,
      })),
      reportFileName: report.fileName,
      generatedAt,
      disclaimer:
        'Expert Witness Investigation output is for attorney research only. Mock sources are used when live API keys are not configured.',
    };

    this.logger.log(
      `EWI complete for ${request.expertName}: ${questions.length} questions, ${bundle.evidence.length} evidence items`,
    );

    return { result, report };
  }
}
