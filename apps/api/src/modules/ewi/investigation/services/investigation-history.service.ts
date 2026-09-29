import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageSettings } from '@config/config.types';
import { targetsFromEvidence } from '../../correspondence/ewi-request-from-evidence';
import { EwiRequestWorkflowService } from '../../correspondence/ewi-request-workflow.service';
import { ExpertInvestigationRepository } from '../repositories/expert-investigation.repository';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Injectable()
export class InvestigationHistoryService {
  private readonly logger = new Logger(InvestigationHistoryService.name);

  constructor(
    private readonly repo: ExpertInvestigationRepository,
    private readonly config: ConfigService,
    private readonly requestWorkflow: EwiRequestWorkflowService,
  ) {}

  create(jobId: string, dto: CreateExpertInvestigationDto) {
    return this.repo.create(jobId, dto);
  }

  listHistories() {
    return this.repo.list();
  }

  async getHistory(id: string) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException(`Investigation "${id}" not found`);
    }
    return row;
  }

  async deleteHistory(id: string): Promise<void> {
    await this.getHistory(id);
    await this.repo.delete(id);
  }

  cancel(id: string) {
    return this.repo.cancel(id);
  }

  cancelByJobId(jobId: string) {
    return this.repo.cancelByJobId(jobId);
  }

  async isCancelledByJobId(jobId: string): Promise<boolean> {
    const row = await this.repo.findByJobId(jobId);
    return row?.status === 'cancelled';
  }

  async getReport(id: string): Promise<{
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }> {
    const row = await this.getHistory(id);
    if (!row.reportStorageKey || !row.reportFileName || !row.reportMimeType) {
      throw new NotFoundException(`Report for investigation "${id}" not found`);
    }
    const buffer = await readFile(row.reportStorageKey);
    return {
      fileName: row.reportFileName,
      mimeType: row.reportMimeType,
      buffer,
    };
  }

  updateFromJob(
    jobId: string,
    data: Parameters<ExpertInvestigationRepository['updateProgress']>[1],
  ) {
    return this.repo.updateProgress(jobId, data);
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
  ) {
    const directory = join(this.reportsDirectory(), 'investigations');
    await mkdir(directory, { recursive: true });
    const storageKey = join(directory, `${jobId}.docx`);
    await writeFile(storageKey, report.buffer);
    const completed = await this.repo.markCompleted(jobId, result, {
      fileName: report.fileName,
      mimeType: report.mimeType,
      storageKey,
      byteSize: report.buffer.byteLength,
      templateId: report.templateId,
      templateVersion: report.templateVersion,
    });

    if (completed) {
      await this.prepareConfiguredRequests(completed.investigationId, result);
    }
    return completed;
  }

  markFailed(jobId: string, errorMessage: string) {
    return this.repo.markFailed(jobId, errorMessage);
  }

  private async prepareConfiguredRequests(
    investigationId: string,
    result: EwiInvestigationResult,
  ): Promise<void> {
    try {
      const targets = targetsFromEvidence(result.evidence);
      if (targets.length === 0) return;
      const prepared = await this.requestWorkflow.prepare({
        investigationId,
        expertName: result.expertName,
        city: result.city,
        specialty: result.specialty,
        caseReference: `EWI-${investigationId.slice(0, 8)}`,
        targets,
      });
      if (prepared.length > 0) {
        this.logger.log(
          `Prepared ${prepared.length} EWI request draft(s) for investigation=${investigationId}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Request prepare failed';
      this.logger.warn(
        `EWI request prepare skipped for investigation=${investigationId}: ${message}`,
      );
    }
  }

  private reportsDirectory(): string {
    const storage = this.config.get<StorageSettings>('storage');
    return (
      storage?.products.ewi.reports ??
      join(process.cwd(), 'knowledge-base', 'ewi', 'reports')
    );
  }
}
