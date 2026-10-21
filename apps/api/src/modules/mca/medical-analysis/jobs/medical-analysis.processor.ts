import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { RedisService } from '@redis/redis.service';
import { describeAiFailure, describeError } from '@ai/utils';
import { QUEUE_PREFIXES } from '@platform/jobs/job.types';
import { workerConnection, workerOptions } from '@platform/jobs/worker-options';
import { MEDICAL_ANALYSIS_QUEUE_NAME } from './medical-analysis-job.constants';
import { MedicalAnalysisJobService } from './medical-analysis-job.service';
import type { MedicalAnalysisJobPayload } from './medical-analysis-job.types';
import { MedicalAnalysisService } from '../services/medical-analysis.service';
import { AnalysisSafetyException } from '../exceptions';
import { AnalysisResponseParseError } from '../utils';

/** What the attorney is told when an analysis job fails. */
export function describeAnalysisFailure(error: unknown): {
  code: string;
  message: string;
} {
  if (
    error instanceof AnalysisResponseParseError ||
    error instanceof AnalysisSafetyException
  ) {
    return {
      code: 'ANALYSIS_NOT_VERIFIED',
      message:
        "The AI's answer did not pass the citation and format checks, so no report was produced. Please run the analysis again.",
    };
  }
  return (
    describeAiFailure(error, 'the analysis') ?? {
      code: 'ANALYSIS_FAILED',
      message:
        'Something went wrong and the analysis did not complete. Please try again. If it keeps happening, contact support.',
    }
  );
}

@Injectable()
export class MedicalAnalysisProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicalAnalysisProcessor.name);
  private worker?: Worker<MedicalAnalysisJobPayload>;

  constructor(
    private readonly redisService: RedisService,
    private readonly jobService: MedicalAnalysisJobService,
    private readonly analysisService: MedicalAnalysisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<MedicalAnalysisJobPayload>(
      MEDICAL_ANALYSIS_QUEUE_NAME,
      async (job) => this.process(job.data),
      {
        connection: workerConnection(this.redisService.getConnectionOptions()),
        prefix: QUEUE_PREFIXES.MCA,
        ...workerOptions(this.config),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Job ${job?.id ?? 'unknown'} failed: ${describeError(error)}`,
      );
    });

    this.logger.log('Medical analysis worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(payload: MedicalAnalysisJobPayload): Promise<void> {
    const { jobId, caseId, request } = payload;

    try {
      await this.jobService.markRunning(jobId);
      const result = await this.analysisService.analyze(request, {
        caseId,
        onProgress: (update) => this.jobService.reportProgress(jobId, update),
      });
      await this.jobService.markCompleted(jobId, result);
      this.logger.log(`Medical analysis job ${jobId} completed`);
    } catch (error) {
      // The user sees a plain explanation; the log keeps the technical
      // detail, with keys redacted and no case data.
      const failure = describeAnalysisFailure(error);
      this.logger.error(
        `Medical analysis job ${jobId} failed (${failure.code}): ${describeError(error)}`,
      );
      try {
        await this.jobService.markFailed(jobId, failure.message);
      } catch (markError) {
        const markMessage =
          markError instanceof Error ? markError.message : String(markError);
        this.logger.error(
          `Unable to record failure for job ${jobId}: ${markMessage}`,
        );
      }
      throw error;
    }
  }
}
