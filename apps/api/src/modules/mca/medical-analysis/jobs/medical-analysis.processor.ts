import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { RedisService } from '@redis/redis.service';
import { QUEUE_PREFIXES } from '@platform/queues/queue-prefixes';
import { MEDICAL_ANALYSIS_QUEUE_NAME } from './medical-analysis-job.constants';
import { MedicalAnalysisJobService } from './medical-analysis-job.service';
import type { MedicalAnalysisJobPayload } from './medical-analysis-job.types';
import { MedicalAnalysisService } from '../services/medical-analysis.service';

@Injectable()
export class MedicalAnalysisProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicalAnalysisProcessor.name);
  private worker?: Worker<MedicalAnalysisJobPayload>;

  constructor(
    private readonly redisService: RedisService,
    private readonly jobService: MedicalAnalysisJobService,
    private readonly analysisService: MedicalAnalysisService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<MedicalAnalysisJobPayload>(
      MEDICAL_ANALYSIS_QUEUE_NAME,
      async (job) => this.process(job.data),
      {
        connection: this.redisService.getConnectionOptions(),
        prefix: QUEUE_PREFIXES.MCA,
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });

    this.logger.log('Medical analysis worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(payload: MedicalAnalysisJobPayload): Promise<void> {
    const { jobId, request } = payload;

    try {
      await this.jobService.markRunning(jobId);
      const result = await this.analysisService.analyze(request, {
        onProgress: (update) => this.jobService.reportProgress(jobId, update),
      });
      await this.jobService.markCompleted(jobId, result);
      this.logger.log(`Medical analysis job ${jobId} completed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown analysis error';
      this.logger.error(`Medical analysis job ${jobId} failed: ${message}`);
      try {
        await this.jobService.markFailed(jobId, message);
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
