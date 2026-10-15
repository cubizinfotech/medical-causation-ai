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
  ANALYSIS_JOB_STATUS,
  ANALYSIS_JOB_STEP_LABELS,
  ANALYSIS_JOB_STEPS,
  MEDICAL_ANALYSIS_QUEUE_NAME,
} from './medical-analysis-job.constants';
import type {
  AnalysisProgressUpdate,
  CreateMedicalAnalysisJobResponse,
  MedicalAnalysisJobPayload,
  MedicalAnalysisJobRecord,
} from './medical-analysis-job.types';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import { mapCaseDtoToAnalysisRequest } from '../utils/case-request.mapper';
import type { MedicalAnalysisGateway } from '../gateway/medical-analysis.gateway';
import { AnalysisHistoryService } from '../services/analysis-history.service';
import { CaseRecordsService } from '../records/case-records.service';

@Injectable()
export class MedicalAnalysisJobService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MedicalAnalysisJobService.name);
  private queue!: Queue<MedicalAnalysisJobPayload>;
  private gateway?: MedicalAnalysisGateway;

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AnalysisHistoryService))
    private readonly historyService: AnalysisHistoryService,
    private readonly caseRecords: CaseRecordsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  setGateway(gateway: MedicalAnalysisGateway): void {
    this.gateway = gateway;
  }

  onModuleInit(): void {
    this.queue = new Queue<MedicalAnalysisJobPayload>(
      MEDICAL_ANALYSIS_QUEUE_NAME,
      {
        connection: this.redisService.getConnectionOptions(),
        prefix: QUEUE_PREFIXES.MCA,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private jobKey(jobId: string): string {
    return `analysis:job:${jobId}`;
  }

  async enqueue(
    dto: AnalyzeMedicalCaseDto,
    ownerUserId: string,
  ): Promise<CreateMedicalAnalysisJobResponse> {
    const request = mapCaseDtoToAnalysisRequest(dto);
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const recordIds = request.recordIds ?? [];

    await assertDailyJobQuota(
      this.prisma,
      ownerUserId,
      this.config.get<JobsSettings>('jobs')?.dailyLimitPerUser ?? 0,
    );
    // Validate before the case exists, so a bad record list creates nothing.
    if (recordIds.length > 0) {
      await this.caseRecords.assertAttachable(ownerUserId, recordIds);
    }

    const analysisCase = await this.historyService.createCase(
      jobId,
      dto,
      ownerUserId,
    );
    if (recordIds.length > 0) {
      try {
        await this.caseRecords.attachToCase(
          ownerUserId,
          recordIds,
          analysisCase.id,
        );
      } catch (error) {
        // Another analysis took a record first: leave nothing behind.
        await this.historyService.discardCase(analysisCase.id);
        throw error;
      }
    }

    const record: MedicalAnalysisJobRecord = {
      jobId,
      status: ANALYSIS_JOB_STATUS.QUEUED,
      step: ANALYSIS_JOB_STEPS.INTAKE,
      stepLabel: ANALYSIS_JOB_STEP_LABELS[ANALYSIS_JOB_STEPS.INTAKE],
      progress: 5,
      message: 'Analysis queued — starting shortly…',
      createdAt: now,
      updatedAt: now,
    };

    await this.saveRecord(record);

    try {
      await this.queue.add(
        'run',
        { jobId, caseId: analysisCase.id, request },
        {
          jobId,
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 1,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to queue analysis';
      this.logger.error(
        `Failed to queue medical analysis job ${jobId}: ${message}`,
      );
      try {
        await this.markFailed(
          jobId,
          'The analysis could not be started. Please try again in a moment.',
        );
      } catch (markError) {
        const markMessage =
          markError instanceof Error ? markError.message : String(markError);
        this.logger.error(
          `Unable to record queue failure for job ${jobId}: ${markMessage}`,
        );
      }
      throw error;
    }

    this.emit(record);
    this.logger.log(
      `Queued medical analysis job ${jobId} (case ${analysisCase.id})`,
    );

    return {
      caseId: analysisCase.id,
      jobId,
      status: ANALYSIS_JOB_STATUS.QUEUED,
    };
  }

  async getJob(jobId: string): Promise<MedicalAnalysisJobRecord> {
    const record = await this.loadRecord(jobId);
    if (!record) {
      throw new NotFoundException(`Analysis job "${jobId}" not found`);
    }
    return record;
  }

  async deleteJobRecord(jobId: string): Promise<void> {
    await this.redisService.getClient().del(this.jobKey(jobId));
    // An active job is locked by the worker and cannot be removed; it finds
    // no record and no case when it finishes, and saves nothing.

    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Unable to remove queued BullMQ job ${jobId}: ${message}`,
      );
    }
  }

  async markRunning(jobId: string): Promise<void> {
    await this.patch(jobId, {
      status: ANALYSIS_JOB_STATUS.RUNNING,
      step: ANALYSIS_JOB_STEPS.INTAKE,
      stepLabel: ANALYSIS_JOB_STEP_LABELS[ANALYSIS_JOB_STEPS.INTAKE],
      progress: 10,
      message: 'Preparing medical case…',
    });
  }

  async reportProgress(
    jobId: string,
    update: AnalysisProgressUpdate,
  ): Promise<void> {
    await this.patch(jobId, {
      status: ANALYSIS_JOB_STATUS.RUNNING,
      step: update.step,
      stepLabel: update.stepLabel,
      progress: update.progress,
      message: update.message,
    });
  }

  async markCompleted(
    jobId: string,
    result: MedicalAnalysisJobRecord['result'],
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.patch(jobId, {
      status: ANALYSIS_JOB_STATUS.COMPLETED,
      step: ANALYSIS_JOB_STEPS.REPORT,
      stepLabel: ANALYSIS_JOB_STEP_LABELS[ANALYSIS_JOB_STEPS.REPORT],
      progress: 100,
      message: 'Analysis complete.',
      result,
      completedAt: now,
    });
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.loadRecord(jobId);
    if (!existing) {
      const record: MedicalAnalysisJobRecord = {
        jobId,
        status: ANALYSIS_JOB_STATUS.FAILED,
        step: ANALYSIS_JOB_STEPS.INTAKE,
        stepLabel: ANALYSIS_JOB_STEP_LABELS[ANALYSIS_JOB_STEPS.INTAKE],
        progress: 0,
        message: error,
        error,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      };
      await this.saveRecord(record);
      void this.historyService.syncFromJobRecord(record);
      this.emit(record);
      return;
    }

    await this.patch(jobId, {
      status: ANALYSIS_JOB_STATUS.FAILED,
      progress: existing.progress ?? 0,
      error,
      message: error,
      completedAt: now,
    });
  }

  private async patch(
    jobId: string,
    partial: Partial<MedicalAnalysisJobRecord>,
  ): Promise<void> {
    const updated =
      await this.redisService.updateJson<MedicalAnalysisJobRecord>(
        this.jobKey(jobId),
        (existing) => ({
          ...existing,
          ...partial,
          updatedAt: new Date().toISOString(),
        }),
      );
    if (!updated) {
      this.logger.warn(
        `No analysis job record for ${jobId}; status update was not saved`,
      );
      return;
    }

    void this.historyService.syncFromJobRecord(updated);
    this.emit(updated);
  }

  private saveRecord(record: MedicalAnalysisJobRecord): Promise<void> {
    return this.redisService.setJson(this.jobKey(record.jobId), record);
  }

  private loadRecord(jobId: string): Promise<MedicalAnalysisJobRecord | null> {
    return this.redisService.getJson<MedicalAnalysisJobRecord>(
      this.jobKey(jobId),
    );
  }

  /** Job records for many jobs in one round trip (missing ones are null). */
  async loadRecords(
    jobIds: string[],
  ): Promise<Map<string, MedicalAnalysisJobRecord>> {
    const records = new Map<string, MedicalAnalysisJobRecord>();
    if (jobIds.length === 0) return records;
    const raw = await this.redisService
      .getClient()
      .mget(jobIds.map((jobId) => this.jobKey(jobId)));
    raw.forEach((value, index) => {
      if (value) {
        records.set(
          jobIds[index],
          JSON.parse(value) as MedicalAnalysisJobRecord,
        );
      }
    });
    return records;
  }

  private emit(record: MedicalAnalysisJobRecord): void {
    this.gateway?.emitJobUpdate(record.jobId, {
      jobId: record.jobId,
      status: record.status,
      step: record.step,
      stepLabel: record.stepLabel,
      progress: record.progress,
      message: record.message,
      error: record.error,
      result: record.result,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
    });
  }
}
