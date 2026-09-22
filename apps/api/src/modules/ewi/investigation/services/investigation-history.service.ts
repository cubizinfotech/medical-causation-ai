import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpertInvestigationRepository } from '../repositories/expert-investigation.repository';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Injectable()
export class InvestigationHistoryService {
  constructor(private readonly repo: ExpertInvestigationRepository) {}

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

  async getReport(id: string): Promise<{
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }> {
    const row = await this.getHistory(id);
    if (!row.reportData || !row.reportFileName || !row.reportMimeType) {
      throw new NotFoundException(`Report for investigation "${id}" not found`);
    }
    return {
      fileName: row.reportFileName,
      mimeType: row.reportMimeType,
      buffer: Buffer.from(row.reportData, 'base64'),
    };
  }

  updateFromJob(
    jobId: string,
    data: Parameters<ExpertInvestigationRepository['updateProgress']>[1],
  ) {
    return this.repo.updateProgress(jobId, data);
  }

  markCompleted(
    jobId: string,
    result: EwiInvestigationResult,
    report: { fileName: string; mimeType: string; dataBase64: string },
  ) {
    return this.repo.markCompleted(jobId, result, report);
  }

  markFailed(jobId: string, errorMessage: string) {
    return this.repo.markFailed(jobId, errorMessage);
  }
}
