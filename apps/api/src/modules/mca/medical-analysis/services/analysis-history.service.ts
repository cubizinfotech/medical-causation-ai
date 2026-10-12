import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { AnalysisCase } from '@prisma/client';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import type { MedicalAnalysisResult } from '../types';
import type { MedicalAnalysisJobRecord } from '../jobs/medical-analysis-job.types';
import { AnalysisCaseRepository } from '../repositories/analysis-case.repository';
import { MedicalAnalysisJobService } from '../jobs/medical-analysis-job.service';
import { CaseRecordsService } from '../records/case-records.service';

export interface AnalysisHistoryListItem {
  id: string;
  jobId: string;
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
    private readonly caseRecords: CaseRecordsService,
  ) {}

  async createCase(
    jobId: string,
    dto: AnalyzeMedicalCaseDto,
    ownerUserId: string,
  ): Promise<AnalysisCase> {
    return this.repository.create({ jobId, dto, ownerUserId });
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
      result: record.result ? (record.result as object) : undefined,
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
    });
  }

  async listHistories(ownerUserId: string): Promise<AnalysisHistoryListItem[]> {
    const rows = await this.repository.listOwned(ownerUserId);
    const reconciled = await this.reconcileRows(rows);
    return reconciled.map((row) => this.toListItem(row));
  }

  async getHistory(
    id: string,
    ownerUserId: string,
  ): Promise<AnalysisHistoryDetail> {
    const row = await this.repository.findOwned(id, ownerUserId);
    if (!row) {
      throw new NotFoundException(`Analysis history "${id}" not found`);
    }
    const [reconciled] = await this.reconcileRows([row]);
    return this.toDetail(reconciled);
  }

  async assertJobOwner(jobId: string, ownerUserId: string): Promise<void> {
    const row = await this.repository.findOwnedByJobId(jobId, ownerUserId);
    if (!row) {
      throw new NotFoundException(`Analysis job "${jobId}" not found`);
    }
  }

  /** Removes a case that never started (its job was not queued). */
  async discardCase(id: string): Promise<void> {
    await this.repository.delete(id).catch(() => undefined);
  }

  async deleteHistory(id: string, ownerUserId: string): Promise<void> {
    const row = await this.repository.findOwned(id, ownerUserId);
    if (!row) {
      throw new NotFoundException(`Analysis history "${id}" not found`);
    }

    await this.jobService.deleteJobRecord(row.jobId);
    // Record files are patient data: remove them with the analysis.
    await this.caseRecords.deleteFilesForCase(id);
    await this.repository.delete(id);
  }

  async reconcileStaleCases(): Promise<number> {
    const rows = await this.repository.listRecent(200);
    const reconciled = await this.reconcileRows(rows);
    return reconciled.filter((row, index) => row.status !== rows[index].status)
      .length;
  }

  /**
   * Brings queued/running rows up to date with their Redis job records
   * (one Redis call for all of them). Only rows that changed are written.
   */
  private async reconcileRows(rows: AnalysisCase[]): Promise<AnalysisCase[]> {
    const active = rows.filter(
      (row) => row.status === 'queued' || row.status === 'running',
    );
    if (active.length === 0) return rows;
    const records = await this.jobService.loadRecords(
      active.map((row) => row.jobId),
    );
    return Promise.all(
      rows.map((row) =>
        active.includes(row)
          ? this.reconcileRow(row, records.get(row.jobId))
          : Promise.resolve(row),
      ),
    );
  }

  private async reconcileRow(
    row: AnalysisCase,
    record: MedicalAnalysisJobRecord | undefined,
  ): Promise<AnalysisCase> {
    if (record) {
      const unchanged =
        this.repository.mapStatus(record.status) === row.status &&
        record.progress === row.progress &&
        (record.message ?? null) === row.message;
      if (unchanged) return row;
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
