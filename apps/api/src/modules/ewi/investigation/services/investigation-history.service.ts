import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageSettings } from '@config/config.types';
import { targetsFromEvidence } from '../../correspondence/ewi-request-from-evidence';
import { EwiRequestWorkflowService } from '../../correspondence/ewi-request-workflow.service';
import {
  ExpertInvestigationRepository,
  type InvestigationView,
} from '../repositories/expert-investigation.repository';
import { ExpertDocumentsService } from '../../documents/expert-documents.service';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Injectable()
export class InvestigationHistoryService {
  private readonly logger = new Logger(InvestigationHistoryService.name);

  constructor(
    private readonly repo: ExpertInvestigationRepository,
    private readonly config: ConfigService,
    private readonly requestWorkflow: EwiRequestWorkflowService,
    private readonly documents: ExpertDocumentsService,
  ) {}

  async create(
    jobId: string,
    dto: CreateExpertInvestigationDto,
    ownerUserId: string,
  ): Promise<InvestigationView & { cvDocumentId?: string }> {
    if (dto.cvDocumentId) {
      await this.documents.assertOwned(ownerUserId, dto.cvDocumentId);
    }
    const created = await this.repo.create(jobId, dto, ownerUserId);
    if (!dto.cvDocumentId) return created;
    try {
      // May be a copy when the CV came from an earlier investigation.
      const cvDocumentId = await this.documents.attachToInvestigation(
        ownerUserId,
        dto.cvDocumentId,
        created.id,
      );
      return { ...created, cvDocumentId };
    } catch (error) {
      await this.repo.delete(created.id).catch(() => undefined);
      throw error;
    }
  }

  listHistories(ownerUserId: string) {
    return this.repo.listForOwner(ownerUserId);
  }

  async getHistory(id: string, ownerUserId: string) {
    const row = await this.repo.findOwned(id, ownerUserId);
    if (!row) {
      throw new NotFoundException(`Investigation "${id}" not found`);
    }
    return row;
  }

  async assertJobOwner(jobId: string, ownerUserId: string): Promise<void> {
    const owned = await this.repo.ownsJob(jobId, ownerUserId);
    if (!owned) {
      throw new NotFoundException(`Investigation job "${jobId}" not found`);
    }
  }

  async deleteHistory(id: string, ownerUserId: string): Promise<void> {
    await this.getHistory(id, ownerUserId);
    // Rows go with the investigation; the uploaded files are removed here.
    await this.documents.deleteFilesForInvestigation(id);
    await this.repo.delete(id);
  }

  async cancel(id: string, ownerUserId: string) {
    await this.getHistory(id, ownerUserId);
    return this.repo.cancel(id);
  }

  cancelByJobId(jobId: string) {
    return this.repo.cancelByJobId(jobId);
  }

  async isCancelledByJobId(jobId: string): Promise<boolean> {
    const row = await this.repo.findByJobId(jobId);
    return row?.status === 'cancelled';
  }

  async getReport(
    id: string,
    ownerUserId: string,
  ): Promise<{
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }> {
    const row = await this.getHistory(id, ownerUserId);
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
