import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { RedisService } from '@redis/redis.service';
import { QUEUE_PREFIXES } from '@platform/queues/queue-prefixes';
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
import { InvestigationHistoryService } from '../services/investigation-history.service';

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

    await this.saveRecord(record);
    await this.queue.add(
      'run',
      {
        jobId,
        request: {
          expertName: dto.expertName.trim(),
          city: dto.city.trim(),
          specialty: dto.specialty.trim(),
          ...(dto.npi ? { npi: dto.npi } : {}),
        },
      },
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
      },
    );

    this.emit(record);
    this.logger.log(
      `Queued EWI investigation ${jobId} (${investigation.id}) for ${dto.expertName}`,
    );

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
    const record = await this.requireRecord(jobId);
    record.status = EWI_JOB_STATUS.RUNNING;
    record.updatedAt = new Date().toISOString();
    record.message = 'Investigation running…';
    await this.saveRecord(record);
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
    if (await this.isCancelled(jobId)) return;
    const record = await this.requireRecord(jobId);
    if (record.status === EWI_JOB_STATUS.CANCELLED) return;
    record.step = update.step;
    record.stepLabel = update.stepLabel;
    record.progress = update.progress;
    if (update.message) record.message = update.message;
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
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
    checkpoint: import('../workflow/investigation-workflow').InvestigationWorkflowCheckpoint,
  ): Promise<void> {
    const record = await this.requireRecord(jobId);
    if (record.status === EWI_JOB_STATUS.CANCELLED) return;
    record.checkpoint = checkpoint;
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
  }

  async isCancelled(jobId: string): Promise<boolean> {
    const record = await this.loadRecord(jobId);
    if (record?.status === EWI_JOB_STATUS.CANCELLED) return true;
    return this.historyService.isCancelledByJobId(jobId);
  }

  async markCancelled(jobId: string): Promise<void> {
    const record = await this.loadRecord(jobId);
    if (!record) return;
    record.status = EWI_JOB_STATUS.CANCELLED;
    record.message = 'Investigation cancelled';
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
    // Re-assert DB cancelled after any concurrent progress write.
    await this.historyService.cancelByJobId(jobId);
    this.emit(record);
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
    const record = await this.requireRecord(jobId);
    record.status = EWI_JOB_STATUS.COMPLETED;
    record.progress = 100;
    record.step = EWI_STAGE_REPORT;
    record.stepLabel = EWI_JOB_STEP_LABELS[EWI_STAGE_REPORT];
    record.message = 'Investigation complete';
    record.result = result;
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
    await this.historyService.markCompleted(jobId, result, {
      fileName: report.fileName,
      mimeType: report.mimeType,
      buffer: report.buffer,
      templateId: report.templateId,
      templateVersion: report.templateVersion,
    });
    this.emit(record);
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const record = await this.requireRecord(jobId);
    record.status = EWI_JOB_STATUS.FAILED;
    record.error = error;
    record.message = error;
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
    await this.historyService.markFailed(jobId, error);
    this.emit(record);
  }

  private async requireRecord(
    jobId: string,
  ): Promise<EwiInvestigationJobRecord> {
    const record = await this.loadRecord(jobId);
    if (!record) {
      throw new NotFoundException(`EWI job "${jobId}" not found`);
    }
    return record;
  }

  private async saveRecord(record: EwiInvestigationJobRecord): Promise<void> {
    const client = this.redisService.getClient();
    await client.set(
      this.jobKey(record.jobId),
      JSON.stringify(record),
      'EX',
      this.redisService.getTtlSeconds(),
    );
  }

  private async loadRecord(
    jobId: string,
  ): Promise<EwiInvestigationJobRecord | null> {
    const raw = await this.redisService.getClient().get(this.jobKey(jobId));
    if (!raw) return null;
    return JSON.parse(raw) as EwiInvestigationJobRecord;
  }

  private emit(record: EwiInvestigationJobRecord): void {
    this.gateway?.emitJobUpdate(record);
  }
}
