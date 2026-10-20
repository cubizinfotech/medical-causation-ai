import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
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
import {
  EwiPdfReportService,
  type EwiReportInput,
} from '../../report/ewi-pdf-report.service';
import { EwiWordReportService } from '../../report/ewi-word-report.service';
import { EWI_REPORT_TEMPLATE_VERSION } from '../../report/ewi-report.version';

interface ReportFile {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/** The report template's input, from a saved investigation result. */
function reportInput(result: EwiInvestigationResult): EwiReportInput {
  return {
    expertName: result.expertName,
    city: result.city,
    specialty: result.specialty,
    evidence: result.evidence,
    discrepancies: result.discrepancies,
    questions: result.questions,
    generatedAt: result.generatedAt,
    summary: result.summary,
    analysis: result.analysis?.document,
    legalResearch: result.legalResearch,
    onlinePresence: result.onlinePresence,
    professionalBackground: result.professionalBackground,
    identity: result.identity ?? null,
    cvCheck: result.cvCheck ?? null,
    additionalContext: result.additionalContext ?? null,
    webResearch: result.webResearch ?? null,
    sourceStatuses: result.sourceStatuses ?? [],
  };
}

@Injectable()
export class InvestigationHistoryService {
  private readonly logger = new Logger(InvestigationHistoryService.name);

  constructor(
    private readonly repo: ExpertInvestigationRepository,
    private readonly config: ConfigService,
    private readonly requestWorkflow: EwiRequestWorkflowService,
    private readonly documents: ExpertDocumentsService,
    private readonly pdfReport: EwiPdfReportService,
    private readonly wordReport: EwiWordReportService,
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

  /** Deletes the investigation, its uploaded files, and its report file. */
  async deleteHistory(
    id: string,
    ownerUserId: string,
  ): Promise<{ jobId: string }> {
    const row = await this.getHistory(id, ownerUserId);
    // Rows go with the investigation; the files are removed here.
    await this.documents.deleteFilesForInvestigation(id);
    if (row.reportStorageKey) {
      await rm(this.reportPath(row.reportStorageKey), { force: true });
    }
    await this.repo.delete(id);
    return { jobId: row.jobId };
  }

  async cancel(id: string, ownerUserId: string) {
    await this.getHistory(id, ownerUserId);
    return this.repo.cancel(id);
  }

  cancelByJobId(jobId: string) {
    return this.repo.cancelByJobId(jobId);
  }

  /** True when the investigation was cancelled or deleted: the job should stop. */
  async isCancelledByJobId(jobId: string): Promise<boolean> {
    const row = await this.repo.findByJobId(jobId);
    return !row || row.status === 'cancelled';
  }

  async getReport(id: string, ownerUserId: string): Promise<ReportFile> {
    const row = await this.getHistory(id, ownerUserId);
    if (!row.reportStorageKey || !row.reportFileName || !row.reportMimeType) {
      throw new NotFoundException(`Report for investigation "${id}" not found`);
    }
    const path = this.reportPath(row.reportStorageKey);
    const rebuilt = await this.rebuildOutdatedReport(
      row,
      row.reportStorageKey,
      path,
    );
    return (
      rebuilt ?? {
        fileName: row.reportFileName,
        mimeType: row.reportMimeType,
        buffer: await readFile(path),
      }
    );
  }

  /**
   * The report as a Word file, built from the saved investigation when it
   * is exported (the PDF is the stored copy).
   */
  async getWordReport(id: string, ownerUserId: string): Promise<ReportFile> {
    const row = await this.getHistory(id, ownerUserId);
    if (row.status !== 'completed' || !row.result) {
      throw new NotFoundException(
        `Investigation "${id}" has no finished report to export`,
      );
    }
    const report = await this.wordReport.build(reportInput(row.result));
    return {
      fileName: report.fileName,
      mimeType: report.mimeType,
      buffer: report.buffer,
    };
  }

  /**
   * A report saved with an older template is rebuilt from the stored
   * investigation, so wording changes reach reports made before them. A
   * Word report saved before the PDF template is replaced by the PDF. If
   * the rebuild fails, the saved file is returned unchanged.
   */
  private async rebuildOutdatedReport(
    row: InvestigationView,
    storageKey: string,
    path: string,
  ): Promise<ReportFile | null> {
    const result = row.result;
    if (!result || row.reportTemplateVersion === EWI_REPORT_TEMPLATE_VERSION) {
      return null;
    }
    try {
      const report = await this.pdfReport.build(reportInput(result));
      const newKey =
        storageKey.slice(0, storageKey.length - extname(storageKey).length) +
        reportExtension(report.fileName);
      const newPath = this.reportPath(newKey);
      await writeFile(newPath, report.buffer);
      await this.repo.updateReportFile(row.id, {
        fileName: report.fileName,
        mimeType: report.mimeType,
        storageKey: newKey,
        byteSize: report.buffer.byteLength,
        templateVersion: report.templateVersion,
      });
      if (newPath !== path) await rm(path, { force: true });
      this.logger.log(
        `Rebuilt the report of investigation ${row.id} with template ${report.templateVersion}`,
      );
      return {
        fileName: report.fileName,
        mimeType: report.mimeType,
        buffer: report.buffer,
      };
    } catch (error) {
      this.logger.warn(
        `Could not rebuild the report of investigation ${row.id}; serving the saved file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
    // Deleted while the job ran: write no orphan report file.
    if (!(await this.repo.findByJobId(jobId))) return null;
    const directory = join(this.reportsDirectory(), 'investigations');
    await mkdir(directory, { recursive: true });
    const storageKey = join(
      directory,
      `${jobId}${reportExtension(report.fileName)}`,
    );
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

  /** Reports are read and deleted only inside the reports folder. */
  private reportPath(storageKey: string): string {
    const root = resolve(this.reportsDirectory());
    const path = resolve(storageKey);
    const rel = relative(root, path);
    if (!rel || rel.startsWith('..') || resolve(root, rel) !== path) {
      throw new NotFoundException('Report file not found');
    }
    return path;
  }

  private reportsDirectory(): string {
    const storage = this.config.get<StorageSettings>('storage');
    return (
      storage?.products.ewi.reports ??
      join(process.cwd(), 'knowledge-base', 'ewi', 'reports')
    );
  }
}

/** The saved file's extension, from the report's file name (".pdf"). */
function reportExtension(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.pdf';
}
