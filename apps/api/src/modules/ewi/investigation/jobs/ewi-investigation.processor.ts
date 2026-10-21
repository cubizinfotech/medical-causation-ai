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
import { EWI_INVESTIGATION_QUEUE_NAME } from './ewi-investigation-job.constants';
import { EwiInvestigationJobService } from './ewi-investigation-job.service';
import type { EwiInvestigationJobPayload } from './ewi-investigation-job.types';
import {
  ExpertInvestigationService,
  InvestigationCancelledError,
} from '../services/expert-investigation.service';

/** What the attorney is told when an investigation job fails. */
export function describeInvestigationFailure(error: unknown): {
  code: string;
  message: string;
} {
  return (
    describeAiFailure(error, 'the investigation') ?? {
      code: 'INVESTIGATION_FAILED',
      message:
        'Something went wrong and the investigation did not complete. Please run it again. If it keeps happening, contact support.',
    }
  );
}

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
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<EwiInvestigationJobPayload>(
      EWI_INVESTIGATION_QUEUE_NAME,
      async (job) => this.process(job.data),
      {
        connection: workerConnection(this.redisService.getConnectionOptions()),
        prefix: QUEUE_PREFIXES.EWI,
        ...workerOptions(this.config),
      },
    );

    this.worker.on('failed', (job, error) => {
      if (error instanceof InvestigationCancelledError) return;
      this.logger.error(
        `EWI job ${job?.id ?? 'unknown'} failed: ${describeError(error)}`,
      );
    });

    this.logger.log('EWI investigation worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(payload: EwiInvestigationJobPayload): Promise<void> {
    const { jobId, request } = payload;
    if (await this.jobService.isCancelled(jobId)) {
      await this.jobService.markCancelled(jobId);
      return;
    }

    await this.jobService.markRunning(jobId);
    const existing = await this.jobService.getJob(jobId);

    try {
      const outcome = await this.investigationService.investigate(request, {
        jobId,
        checkpoint: existing.checkpoint,
        onProgress: (update) => this.jobService.reportProgress(jobId, update),
        onCheckpoint: (checkpoint) =>
          this.jobService.saveCheckpoint(jobId, checkpoint),
        shouldContinue: async () => !(await this.jobService.isCancelled(jobId)),
      });
      if (await this.jobService.isCancelled(jobId)) {
        await this.jobService.markCancelled(jobId);
        return;
      }
      await this.jobService.markCompleted(
        jobId,
        outcome.result,
        outcome.report,
      );
      this.logger.log(`EWI investigation job ${jobId} completed`);
    } catch (error) {
      if (error instanceof InvestigationCancelledError) {
        await this.jobService.markCancelled(jobId);
        this.logger.log(`EWI investigation job ${jobId} cancelled`);
        return;
      }
      // The attorney sees a plain explanation; the log keeps the detail.
      const failure = describeInvestigationFailure(error);
      this.logger.error(
        `EWI investigation job ${jobId} failed (${failure.code}): ${describeError(error)}`,
      );
      await this.jobService.markFailed(jobId, failure.message);
      throw error;
    }
  }
}
