import { Injectable } from '@nestjs/common';
import type { InvestigationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Injectable()
export class ExpertInvestigationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(jobId: string, dto: CreateExpertInvestigationDto) {
    return this.prisma.expertInvestigation.create({
      data: {
        jobId,
        expertName: dto.expertName,
        specialty: dto.specialty,
        status: 'queued',
        progress: 0,
      },
    });
  }

  findById(id: string) {
    return this.prisma.expertInvestigation.findUnique({ where: { id } });
  }

  findByJobId(jobId: string) {
    return this.prisma.expertInvestigation.findUnique({ where: { jobId } });
  }

  list(limit = 50) {
    return this.prisma.expertInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        jobId: true,
        expertName: true,
        specialty: true,
        status: true,
        step: true,
        stepLabel: true,
        progress: true,
        message: true,
        errorMessage: true,
        reportFileName: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });
  }

  updateProgress(
    jobId: string,
    data: {
      status?: InvestigationStatus;
      step?: string;
      stepLabel?: string;
      progress?: number;
      message?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return this.prisma.expertInvestigation.update({
      where: { jobId },
      data,
    });
  }

  markCompleted(
    jobId: string,
    result: EwiInvestigationResult,
    report: { fileName: string; mimeType: string; dataBase64: string },
  ) {
    return this.prisma.expertInvestigation.update({
      where: { jobId },
      data: {
        status: 'completed',
        progress: 100,
        step: 'report',
        stepLabel: 'Word Report Assembly',
        message: 'Investigation complete',
        result: result as unknown as Prisma.InputJsonValue,
        reportFileName: report.fileName,
        reportMimeType: report.mimeType,
        reportData: report.dataBase64,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  markFailed(jobId: string, errorMessage: string) {
    return this.prisma.expertInvestigation.update({
      where: { jobId },
      data: {
        status: 'failed',
        errorMessage,
        message: errorMessage,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.expertInvestigation.delete({ where: { id } });
  }
}
