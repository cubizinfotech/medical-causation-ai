import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageSettings } from '@config/config.types';
import { ExpertInvestigationRepository } from '../repositories/expert-investigation.repository';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Injectable()
export class InvestigationHistoryService {
  constructor(
    private readonly repo: ExpertInvestigationRepository,
    private readonly config: ConfigService,
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
    report: { fileName: string; mimeType: string; buffer: Buffer },
  ) {
    const directory = join(this.reportsDirectory(), 'investigations');
    await mkdir(directory, { recursive: true });
    const storageKey = join(directory, `${jobId}.docx`);
    await writeFile(storageKey, report.buffer);
    return this.repo.markCompleted(jobId, result, {
      fileName: report.fileName,
      mimeType: report.mimeType,
      storageKey,
      byteSize: report.buffer.byteLength,
    });
  }

  markFailed(jobId: string, errorMessage: string) {
    return this.repo.markFailed(jobId, errorMessage);
  }

  private reportsDirectory(): string {
    const storage = this.config.get<StorageSettings>('storage');
    return (
      storage?.products.ewi.reports ??
      join(process.cwd(), 'knowledge-base', 'ewi', 'reports')
    );
  }
}
