import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import type { AnalysisCase } from '@prisma/client';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import type { MedicalAnalysisResult } from '../types';
import type { MedicalAnalysisJobRecord } from '../jobs/medical-analysis-job.types';
import { AnalysisCaseRepository } from '../repositories/analysis-case.repository';
import { MedicalAnalysisJobService } from '../jobs/medical-analysis-job.service';

export interface AnalysisHistoryListItem {
  id: string;
  jobId: string;
  patientName: string;
  medicalQuestion: string;
  status: string;
  progress: number;
  stepLabel: string | null;
  message: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AnalysisHistoryDetail extends AnalysisHistoryListItem {
  patientAge: string;
  patientGender: string;
  accidentDate: string;
  accidentType: string;
  accidentDescription: string;
  diagnosis: string;
  symptoms: string;
  medicalHistory: string | null;
  medications: string | null;
  timeline: string | null;
  step: string | null;
  errorMessage: string | null;
  result: MedicalAnalysisResult | null;
  updatedAt: string;
}

const STALE_RUNNING_MS = 90 * 60 * 1000;

@Injectable()
export class AnalysisHistoryService {
  constructor(
    private readonly repository: AnalysisCaseRepository,
    @Inject(forwardRef(() => MedicalAnalysisJobService))
    private readonly jobService: MedicalAnalysisJobService,
  ) {}

  async createCase(
    jobId: string,
    dto: AnalyzeMedicalCaseDto,
  ): Promise<AnalysisCase> {
    return this.repository.create({ jobId, dto });
  }

  async syncFromJobRecord(record: MedicalAnalysisJobRecord): Promise<void> {
    const status = this.repository.mapStatus(record.status);

    await this.repository.updateByJobId(record.jobId, {
      status,
      step: record.step,
      stepLabel: record.stepLabel,
      progress: record.progress,
      message: record.message,
      errorMessage: record.error ?? null,
      result: record.result
        ? (record.result as object)
        : undefined,
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
    });
  }

  async listHistories(): Promise<AnalysisHistoryListItem[]> {
    const rows = await this.repository.listRecent();
    const reconciled = await Promise.all(
      rows.map((row) => this.reconcileRow(row)),
    );
    return reconciled.map((row) => this.toListItem(row));
  }

  async getHistory(id: string): Promise<AnalysisHistoryDetail> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException(`Analysis history "${id}" not found`);
    }
    const reconciled = await this.reconcileRow(row);
    return this.toDetail(reconciled);
  }

  async reconcileStaleCases(): Promise<number> {
    const rows = await this.repository.listRecent(200);
    let updated = 0;

    for (const row of rows) {
      const before = row.status;
      const after = (await this.reconcileRow(row)).status;
      if (before !== after) {
        updated++;
      }
    }

    return updated;
  }

  private async reconcileRow(row: AnalysisCase): Promise<AnalysisCase> {
    if (row.status !== 'queued' && row.status !== 'running') {
      return row;
    }

    const record = await this.jobService.tryGetJob(row.jobId);
    if (record) {
      await this.syncFromJobRecord(record);
      return (await this.repository.findById(row.id)) ?? row;
    }

    const ageMs = Date.now() - row.updatedAt.getTime();
    if (ageMs < STALE_RUNNING_MS) {
      return row;
    }

    return this.repository.update(row.id, {
      status: 'failed',
      errorMessage:
        'Analysis was interrupted or expired before completion. Submit the case again.',
      message:
        'Analysis was interrupted or expired before completion. Submit the case again.',
      completedAt: new Date(),
    });
  }

  private toListItem(row: AnalysisCase): AnalysisHistoryListItem {
    return {
      id: row.id,
      jobId: row.jobId,
      patientName: row.patientName,
      medicalQuestion: row.medicalQuestion,
      status: row.status,
      progress: row.progress,
      stepLabel: row.stepLabel,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private toDetail(row: AnalysisCase): AnalysisHistoryDetail {
    return {
      ...this.toListItem(row),
      patientAge: row.patientAge,
      patientGender: row.patientGender,
      accidentDate: row.accidentDate,
      accidentType: row.accidentType,
      accidentDescription: row.accidentDescription,
      diagnosis: row.diagnosis,
      symptoms: row.symptoms,
      medicalHistory: row.medicalHistory,
      medications: row.medications,
      timeline: row.timeline,
      step: row.step,
      errorMessage: row.errorMessage,
      result: (row.result as MedicalAnalysisResult | null) ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
