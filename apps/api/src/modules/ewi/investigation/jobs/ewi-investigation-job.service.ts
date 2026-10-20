import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import type { JobsSettings } from '@config/config.types';
import { PrismaService } from '@database/prisma.service';
import { RedisService } from '@redis/redis.service';
import { QUEUE_PREFIXES } from '@platform/jobs/job.types';
import { assertDailyJobQuota } from '@platform/jobs/daily-quota';
import {
  EWI_INVESTIGATION_QUEUE_NAME,
  EWI_JOB_STATUS,
  EWI_JOB_STEP_LABELS,
  EWI_STAGE_IDENTIFY,
  EWI_STAGE_REPORT,
} from './ewi-investigation-job.constants';
import type {
  CreateEwiInvestigationJobResponse,
  EwiInvestigationJobPayload,
  EwiInvestigationJobRecord,
  EwiInvestigationResult,
  EwiProgressUpdate,
} from './ewi-investigation-job.types';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationGateway } from '../gateway/ewi-investigation.gateway';
import type { InvestigationWorkflowCheckpoint } from '../workflow/investigation-workflow';
import { InvestigationHistoryService } from '../services/investigation-history.service';

const FINISHED: ReadonlySet<string> = new Set([
  EWI_JOB_STATUS.COMPLETED,
  EWI_JOB_STATUS.FAILED,
  EWI_JOB_STATUS.CANCELLED,
]);

@Injectable()
export class EwiInvestigationJobService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EwiInvestigationJobService.name);
  private queue!: Queue<EwiInvestigationJobPayload>;
  private gateway?: EwiInvestigationGateway;

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => InvestigationHistoryService))
    private readonly historyService: InvestigationHistoryService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  setGateway(gateway: EwiInvestigationGateway): void {
    this.gateway = gateway;
  }

  onModuleInit(): void {
    this.queue = new Queue<EwiInvestigationJobPayload>(
      EWI_INVESTIGATION_QUEUE_NAME,
      {
        connection: this.redisService.getConnectionOptions(),
        prefix: QUEUE_PREFIXES.EWI,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private jobKey(jobId: string): string {
    return `ewi:investigation:job:${jobId}`;
  }

  async enqueue(
    dto: CreateExpertInvestigationDto,
    ownerUserId: string,
  ): Promise<CreateEwiInvestigationJobResponse> {
    await assertDailyJobQuota(
      this.prisma,
      ownerUserId,
      this.config.get<JobsSettings>('jobs')?.dailyLimitPerUser ?? 0,
    );
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const investigation = await this.historyService.create(
      jobId,
      dto,
      ownerUserId,
    );

    const record: EwiInvestigationJobRecord = {
      jobId,
      investigationId: investigation.id,
      status: EWI_JOB_STATUS.PENDING,
      step: EWI_STAGE_IDENTIFY,
      stepLabel: EWI_JOB_STEP_LABELS[EWI_STAGE_IDENTIFY],
      progress: 5,
      message: 'Investigation pending — starting shortly…',
      createdAt: now,
      updatedAt: now,
    };

    await this.redisService.setJson(this.jobKey(jobId), record);
    try {
      await this.queue.add(
        'run',
        {
          jobId,
          request: {
            expertName: dto.expertName.trim(),
            city: dto.city?.trim() ?? '',
            specialty: dto.specialty.trim(),
            ...(dto.npi ? { npi: dto.npi } : {}),
            ...(dto.additionalContext?.trim()
              ? { additionalContext: dto.additionalContext.trim() }
              : {}),
            ...(investigation.cvDocumentId
              ? { cvDocumentId: investigation.cvDocumentId }
              : {}),
          },
        },
        {
          jobId,
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 1,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to queue investigation';
      this.logger.error(`Failed to queue EWI job ${jobId}: ${message}`);
      await this.markFailed(jobId, 'The investigation could not be started.');
      throw error;
    }

    this.emit(record);
    this.logger.log(`Queued EWI investigation ${jobId} (${investigation.id})`);

    return {
      investigationId: investigation.id,
      jobId,
      status: EWI_JOB_STATUS.PENDING,
    };
  }

  async getJob(jobId: string): Promise<EwiInvestigationJobRecord> {
    const record = await this.loadRecord(jobId);
    if (!record) {
      throw new NotFoundException(`EWI job "${jobId}" not found`);
    }
    return record;
  }

  async markRunning(jobId: string): Promise<void> {
    const record = await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      status: EWI_JOB_STATUS.RUNNING,
      message: 'Investigation running…',
    }));
    if (!record) return;
    await this.historyService.updateFromJob(jobId, {
      status: 'running',
      message: record.message,
    });
    this.emit(record);
  }

  async reportProgress(
    jobId: string,
    update: EwiProgressUpdate,
  ): Promise<void> {
    const record = await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      step: update.step,
      stepLabel: update.stepLabel,
      progress: update.progress,
      message: update.message ?? current.message,
    }));
    if (!record) return;
    await this.historyService.updateFromJob(jobId, {
      status: 'running',
      step: update.step,
      stepLabel: update.stepLabel,
      progress: update.progress,
      message: update.message ?? null,
    });
    this.emit(record);
  }

  async saveCheckpoint(
    jobId: string,
    checkpoint: InvestigationWorkflowCheckpoint,
  ): Promise<void> {
    await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      checkpoint,
    }));
  }

  async isCancelled(jobId: string): Promise<boolean> {
    const record = await this.loadRecord(jobId);
    if (record?.status === EWI_JOB_STATUS.CANCELLED) return true;
    return this.historyService.isCancelledByJobId(jobId);
  }

  async markCancelled(jobId: string): Promise<void> {
    const record = await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      status: EWI_JOB_STATUS.CANCELLED,
      message: 'Investigation cancelled',
    }));
    // Re-assert DB cancelled after any concurrent progress write.
    await this.historyService.cancelByJobId(jobId);
    if (record) this.emit(record);
  }

  async markCompleted(
    jobId: string,
    result: EwiInvestigationResult,
    report: {
      fileName: string;
      mimeType: string;
      buffer: Buffer;
      templateId?: string;
      templateVersion?: string;
    },
  ): Promise<void> {
    const record = await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      status: EWI_JOB_STATUS.COMPLETED,
      progress: 100,
      step: EWI_STAGE_REPORT,
      stepLabel: EWI_JOB_STEP_LABELS[EWI_STAGE_REPORT],
      message: 'Investigation complete',
      result,
    }));
    // Cancelled meanwhile: keep that outcome and write no report. A record
    // that expired from Redis still completes in the database.
    if (record === null) return;
    await this.historyService.markCompleted(jobId, result, report);
    if (record) this.emit(record);
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const record = await this.updateUnlessFinished(jobId, (current) => ({
      ...current,
      status: EWI_JOB_STATUS.FAILED,
      error,
      message: error,
    }));
    if (record === null) return;
    await this.historyService.markFailed(jobId, error);
    if (record) this.emit(record);
  }

  /** Removes the progress record and a job that has not started yet. */
  async deleteJobRecord(jobId: string): Promise<void> {
    await this.redisService.getClient().del(this.jobKey(jobId));
    try {
      await (await this.queue.getJob(jobId))?.remove();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to remove queued EWI job ${jobId}: ${message}`);
    }
  }

  /**
   * Applies a change to the job record unless the job already finished
   * (a cancel must not be undone by a late progress write).
   * Returns the new record, null when the job had already finished, or
   * undefined when there is no record (expired or deleted).
   */
  private async updateUnlessFinished(
    jobId: string,
    mutate: (current: EwiInvestigationJobRecord) => EwiInvestigationJobRecord,
  ): Promise<EwiInvestigationJobRecord | null | undefined> {
    let finished = false;
    const record =
      await this.redisService.updateJson<EwiInvestigationJobRecord>(
        this.jobKey(jobId),
        (current) => {
          finished = FINISHED.has(current.status);
          if (finished) return current;
          return { ...mutate(current), updatedAt: new Date().toISOString() };
        },
      );
    if (!record) return undefined;
    return finished ? null : record;
  }

  private loadRecord(jobId: string): Promise<EwiInvestigationJobRecord | null> {
    return this.redisService.getJson<EwiInvestigationJobRecord>(
      this.jobKey(jobId),
    );
  }

  private emit(record: EwiInvestigationJobRecord): void {
    this.gateway?.emitJobUpdate(record);
  }
}
