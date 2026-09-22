import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { RedisService } from '@redis/redis.service';
import { QUEUE_PREFIXES } from '@platform/queues/queue-prefixes';
import { EWI_INVESTIGATION_QUEUE_NAME } from './ewi-investigation-job.constants';
import { EwiInvestigationJobService } from './ewi-investigation-job.service';
import type { EwiInvestigationJobPayload } from './ewi-investigation-job.types';
import { ExpertInvestigationService } from '../services/expert-investigation.service';

@Injectable()
export class EwiInvestigationProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EwiInvestigationProcessor.name);
  private worker?: Worker<EwiInvestigationJobPayload>;

  constructor(
    private readonly redisService: RedisService,
    private readonly jobService: EwiInvestigationJobService,
    private readonly investigationService: ExpertInvestigationService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<EwiInvestigationJobPayload>(
      EWI_INVESTIGATION_QUEUE_NAME,
      async (job) => this.process(job.data),
      {
        connection: this.redisService.getConnectionOptions(),
        prefix: QUEUE_PREFIXES.EWI,
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `EWI job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });

    this.logger.log('EWI investigation worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(payload: EwiInvestigationJobPayload): Promise<void> {
    const { jobId, request } = payload;
    await this.jobService.markRunning(jobId);

    try {
      const outcome = await this.investigationService.investigate(request, {
        onProgress: (update) => this.jobService.reportProgress(jobId, update),
      });
      await this.jobService.markCompleted(
        jobId,
        outcome.result,
        outcome.report,
      );
      this.logger.log(`EWI investigation job ${jobId} completed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown investigation error';
      await this.jobService.markFailed(jobId, message);
      throw error;
    }
  }
}
