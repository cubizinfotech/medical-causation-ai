import { Injectable } from '@nestjs/common';
import type { AnalysisCase, AnalysisCaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';

export interface CreateAnalysisCaseInput {
  jobId: string;
  dto: AnalyzeMedicalCaseDto;
}

@Injectable()
export class AnalysisCaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAnalysisCaseInput): Promise<AnalysisCase> {
    const { dto, jobId } = input;

    return this.prisma.analysisCase.create({
      data: {
        jobId,
        patientName: dto.patientName,
        patientAge: dto.patientAge,
        patientGender: dto.patientGender,
        accidentDate: dto.accidentDate,
        accidentType: dto.accidentType,
        accidentDescription: dto.accidentDescription,
        diagnosis: dto.diagnosis,
        symptoms: dto.symptoms,
        medicalHistory: dto.medicalHistory ?? null,
        medications: dto.medications ?? null,
        timeline: dto.timeline ?? null,
        medicalQuestion: dto.medicalQuestion,
        status: 'queued',
        progress: 5,
        message: 'Analysis queued — starting shortly…',
      },
    });
  }

  findById(id: string): Promise<AnalysisCase | null> {
    return this.prisma.analysisCase.findUnique({ where: { id } });
  }

  findByJobId(jobId: string): Promise<AnalysisCase | null> {
    return this.prisma.analysisCase.findUnique({ where: { jobId } });
  }

  listRecent(limit = 50): Promise<AnalysisCase[]> {
    return this.prisma.analysisCase.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  update(
    id: string,
    data: Prisma.AnalysisCaseUpdateInput,
  ): Promise<AnalysisCase> {
    return this.prisma.analysisCase.update({ where: { id }, data });
  }

  updateByJobId(
    jobId: string,
    data: Prisma.AnalysisCaseUpdateInput,
  ): Promise<AnalysisCase | null> {
    return this.prisma.analysisCase
      .update({ where: { jobId }, data })
      .catch(() => null);
  }

  delete(id: string): Promise<AnalysisCase> {
    return this.prisma.analysisCase.delete({ where: { id } });
  }

  mapStatus(status: string): AnalysisCaseStatus {
    if (
      status === 'queued' ||
      status === 'running' ||
      status === 'completed' ||
      status === 'failed'
    ) {
      return status;
    }
    return 'failed';
  }
}
