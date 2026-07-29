import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../redis/redis.service';
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
import type { MedicalAnalysisRequest } from '../types';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import { mapCaseDtoToAnalysisRequest } from '../utils/case-request.mapper';
import type { MedicalAnalysisGateway } from '../gateway/medical-analysis.gateway';
import { AnalysisHistoryService } from '../services/analysis-history.service';

@Injectable()
export class MedicalAnalysisJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicalAnalysisJobService.name);
  private queue!: Queue<MedicalAnalysisJobPayload>;
  private gateway?: MedicalAnalysisGateway;

  constructor(
    private readonly redisService: RedisService,
    private readonly historyService: AnalysisHistoryService,
  ) {}

  setGateway(gateway: MedicalAnalysisGateway): void {
    this.gateway = gateway;
  }

  onModuleInit(): void {
    this.queue = new Queue<MedicalAnalysisJobPayload>(
      MEDICAL_ANALYSIS_QUEUE_NAME,
      {
        connection: this.redisService.getConnectionOptions(),
        prefix: '{mca-bull}',
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
  ): Promise<CreateMedicalAnalysisJobResponse> {
    const request = mapCaseDtoToAnalysisRequest(dto);
    const jobId = randomUUID();
    const now = new Date().toISOString();

    const analysisCase = await this.historyService.createCase(jobId, dto);

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

    await this.queue.add(
      'run',
      { jobId, request },
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
      },
    );

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
    await this.patch(jobId, {
      status: ANALYSIS_JOB_STATUS.FAILED,
      progress: 0,
      error,
      message: error,
      completedAt: now,
    });
  }

  private async patch(
    jobId: string,
    partial: Partial<MedicalAnalysisJobRecord>,
  ): Promise<void> {
    const existing = await this.loadRecord(jobId);
    if (!existing) return;

    const updated: MedicalAnalysisJobRecord = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    await this.saveRecord(updated);
    void this.historyService.syncFromJobRecord(updated);
    this.emit(updated);
  }

  private async saveRecord(record: MedicalAnalysisJobRecord): Promise<void> {
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
  ): Promise<MedicalAnalysisJobRecord | null> {
    const raw = await this.redisService.getClient().get(this.jobKey(jobId));
    if (!raw) return null;
    return JSON.parse(raw) as MedicalAnalysisJobRecord;
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
