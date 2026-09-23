import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InvestigationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';
import {
  EWI_JOB_STEP_LABELS,
  EWI_JOB_STEPS,
} from '../jobs/ewi-investigation-job.constants';
import {
  InvalidInvestigationTransitionError,
  assertInvestigationTransition,
  toStorableFinding,
  type InvestigationLifecycleStatus,
} from '../domain/investigation-lifecycle';

const EWI_RESULT_DISCLAIMER =
  'Expert Witness Investigation output is for attorney research only. Restricted sources are stored as metadata and links only.';

const detailInclude = {
  expert: true,
  profile: true,
  findings: { include: { source: true } },
  discrepancies: true,
  questions: { orderBy: { number: 'asc' as const } },
  report: true,
} satisfies Prisma.InvestigationInclude;

type InvestigationDetail = Prisma.InvestigationGetPayload<{
  include: typeof detailInclude;
}>;

export interface InvestigationView {
  id: string;
  jobId: string;
  expertId: string;
  expertName: string;
  specialty: string;
  status: InvestigationStatus;
  step: string | null;
  stepLabel: string | null;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  notes: string | null;
  reportFileName: string | null;
  reportMimeType: string | null;
  reportStorageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  result: EwiInvestigationResult | null;
}

@Injectable()
export class ExpertInvestigationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(jobId: string, dto: CreateExpertInvestigationDto) {
    const name = dto.expertName.trim();
    const specialty = dto.specialty.trim();

    const created = await this.prisma.$transaction(async (tx) => {
      const expert = await tx.expert.upsert({
        where: { name_specialty: { name, specialty } },
        create: { name, specialty },
        update: {},
      });

      return tx.investigation.create({
        data: {
          jobId,
          expertId: expert.id,
          status: 'pending',
          currentStage: EWI_JOB_STEPS.INTAKE,
          stageLabel: EWI_JOB_STEP_LABELS[EWI_JOB_STEPS.INTAKE],
          progress: 0,
          profile: {
            create: { displayName: name, specialty },
          },
          events: {
            create: {
              eventType: 'created',
              status: 'pending',
              stage: EWI_JOB_STEPS.INTAKE,
              message: 'Investigation started',
            },
          },
        },
        include: { expert: true, report: true },
      });
    });

    return this.toListItem(created);
  }

  async findById(id: string): Promise<InvestigationView | null> {
    const row = await this.prisma.investigation.findUnique({
      where: { id },
      include: detailInclude,
    });
    return row ? this.toDetail(row) : null;
  }

  findByJobId(jobId: string) {
    return this.prisma.investigation.findUnique({
      where: { jobId },
      include: { expert: true, report: true },
    });
  }

  async list(limit = 50): Promise<InvestigationView[]> {
    const rows = await this.prisma.investigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { expert: true, report: true },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async updateProgress(
    jobId: string,
    data: {
      status?: InvestigationLifecycleStatus;
      step?: string;
      stepLabel?: string;
      progress?: number;
      message?: string | null;
      errorMessage?: string | null;
    },
  ) {
    const current = await this.requireByJobId(jobId);
    if (current.status === 'cancelled') return current;
    if (data.status && data.status !== current.status) {
      this.guardTransition(current.status, data.status);
    }

    const stageChanged =
      data.step !== undefined && data.step !== current.currentStage;

    return this.prisma.investigation.update({
      where: { jobId },
      data: {
        status: data.status,
        currentStage: data.step,
        stageLabel: data.stepLabel,
        progress: data.progress,
        message: data.message,
        errorMessage: data.errorMessage,
        startedAt:
          data.status === 'running' && !current.startedAt
            ? new Date()
            : undefined,
        events: stageChanged
          ? {
              create: {
                eventType: 'stage_changed',
                status: data.status ?? current.status,
                stage: data.step,
                message: data.message ?? data.stepLabel ?? null,
              },
            }
          : undefined,
      },
    });
  }

  async markCompleted(
    jobId: string,
    result: EwiInvestigationResult,
    report: {
      fileName: string;
      mimeType: string;
      storageKey: string;
      byteSize: number;
    },
  ) {
    const current = await this.requireByJobId(jobId);
    if (current.status === 'cancelled') return;
    this.guardTransition(current.status, 'completed');

    const storedFindings = result.evidence.map((item) => {
      const publishedRaw = item.raw?.publishedAt ?? item.raw?.publicationDate;
      const publishedAt = parsePublishedAt(publishedRaw);
      return toStorableFinding({
        title: item.title,
        summary: item.summary,
        url: item.url,
        sourceType: item.category,
        provider: item.sourceId,
        publishedAt,
        restricted: item.access === 'restricted' || item.source?.access === 'restricted',
      });
    });

    await this.prisma.$transaction(async (tx) => {
      const groups = new Map<string, typeof storedFindings>();
      for (const finding of storedFindings) {
        const bucket = groups.get(finding.provider) ?? [];
        bucket.push(finding);
        groups.set(finding.provider, bucket);
      }

      for (const [provider, items] of groups) {
        const sourceTypes = new Set(items.map((item) => item.sourceType));
        const source = await tx.researchSource.create({
          data: {
            investigationId: current.id,
            provider,
            sourceType: sourceTypes.size === 1 ? items[0].sourceType : 'mixed',
            name: provider,
            url: items.find((item) => item.url)?.url ?? null,
            publishedAt:
              items.find((item) => item.publishedAt)?.publishedAt ?? null,
            restricted: items.some((item) => item.restricted),
          },
        });

        await tx.researchFinding.createMany({
          data: items.map((item) => ({
            investigationId: current.id,
            sourceId: source.id,
            title: item.title,
            summary: item.summary,
            url: item.url,
            sourceType: item.sourceType,
            publishedAt: item.publishedAt,
            verificationStatus: 'unverified',
            notes: item.notes,
          })),
        });
      }

      if (result.discrepancies.length > 0) {
        await tx.discrepancy.createMany({
          data: result.discrepancies.map((item) => ({
            investigationId: current.id,
            severity: item.severity,
            title: item.title,
            description: item.description,
            relatedUrls: item.relatedUrls,
          })),
        });
      }

      if (result.questions.length > 0) {
        await tx.crossExamQuestion.createMany({
          data: result.questions.map((item) => ({
            investigationId: current.id,
            number: item.number,
            category: item.category,
            question: item.question,
            evidenceBasis: item.evidenceBasis,
          })),
        });
      }

      await tx.investigationReport.create({
        data: {
          investigationId: current.id,
          fileName: report.fileName,
          mimeType: report.mimeType,
          storageKey: report.storageKey,
          byteSize: report.byteSize,
          generatedAt: new Date(result.generatedAt),
        },
      });

      const profileSummary = storedFindings.find(
        (item) =>
          !item.restricted &&
          item.summary &&
          (item.sourceType === 'profile' || item.sourceType === 'identity'),
      )?.summary;

      if (profileSummary) {
        await tx.expertProfile.update({
          where: { investigationId: current.id },
          data: { summary: profileSummary },
        });
      }

      await tx.investigation.update({
        where: { id: current.id },
        data: {
          status: 'completed',
          progress: 100,
          currentStage: EWI_JOB_STEPS.REPORT,
          stageLabel: EWI_JOB_STEP_LABELS[EWI_JOB_STEPS.REPORT],
          message: 'Investigation complete',
          errorMessage: null,
          completedAt: new Date(),
          events: {
            create: {
              eventType: 'completed',
              status: 'completed',
              stage: EWI_JOB_STEPS.REPORT,
              message: 'Investigation complete',
            },
          },
        },
      });
    });
  }

  async markFailed(jobId: string, errorMessage: string) {
    const current = await this.requireByJobId(jobId);
    if (current.status === 'cancelled') return current;
    this.guardTransition(current.status, 'failed');
    return this.prisma.investigation.update({
      where: { jobId },
      data: {
        status: 'failed',
        errorMessage,
        message: errorMessage,
        events: {
          create: {
            eventType: 'failed',
            status: 'failed',
            stage: current.currentStage,
            message: errorMessage,
          },
        },
      },
    });
  }

  async cancel(id: string): Promise<InvestigationView> {
    const current = await this.prisma.investigation.findUnique({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException(`Investigation "${id}" not found`);
    }
    this.guardTransition(current.status, 'cancelled');

    await this.prisma.investigation.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        message: 'Investigation cancelled',
        events: {
          create: {
            eventType: 'cancelled',
            status: 'cancelled',
            stage: current.currentStage,
            message: 'Investigation cancelled',
          },
        },
      },
    });

    const view = await this.findById(id);
    if (!view) {
      throw new NotFoundException(`Investigation "${id}" not found`);
    }
    return view;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.investigation.delete({ where: { id } });
  }

  private async requireByJobId(jobId: string) {
    const current = await this.prisma.investigation.findUnique({
      where: { jobId },
    });
    if (!current) {
      throw new NotFoundException(`Investigation for job "${jobId}" not found`);
    }
    return current;
  }

  private guardTransition(
    from: InvestigationStatus,
    to: InvestigationLifecycleStatus,
  ): void {
    try {
      assertInvestigationTransition(from, to);
    } catch (error) {
      if (error instanceof InvalidInvestigationTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private toListItem(row: {
    id: string;
    jobId: string;
    expertId: string;
    status: InvestigationStatus;
    currentStage: string | null;
    stageLabel: string | null;
    progress: number;
    message: string | null;
    errorMessage: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    expert: { name: string; specialty: string };
    report: { fileName: string; mimeType: string; storageKey: string } | null;
  }): InvestigationView {
    return {
      id: row.id,
      jobId: row.jobId,
      expertId: row.expertId,
      expertName: row.expert.name,
      specialty: row.expert.specialty,
      status: row.status,
      step: row.currentStage,
      stepLabel: row.stageLabel,
      progress: row.progress,
      message: row.message,
      errorMessage: row.errorMessage,
      notes: row.notes,
      reportFileName: row.report?.fileName ?? null,
      reportMimeType: row.report?.mimeType ?? null,
      reportStorageKey: row.report?.storageKey ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      result: null,
    };
  }

  private toDetail(row: InvestigationDetail): InvestigationView {
    const base = this.toListItem(row);
    if (
      row.findings.length === 0 &&
      row.questions.length === 0 &&
      row.discrepancies.length === 0
    ) {
      return base;
    }

    return {
      ...base,
      result: {
        expertName: row.expert.name,
        specialty: row.expert.specialty,
        evidence: row.findings.map((finding) => ({
          sourceId: finding.source
            .provider as EwiInvestigationResult['evidence'][number]['sourceId'],
          category: finding.sourceType,
          title: finding.title,
          summary: finding.summary ?? '',
          url: finding.url ?? undefined,
        })),
        discrepancies: row.discrepancies.map((item) => ({
          id: item.id,
          severity: item.severity as 'low' | 'medium' | 'high',
          title: item.title,
          description: item.description,
          evidenceIds: [],
          relatedUrls: item.relatedUrls,
        })),
        questions: row.questions.map((item) => ({
          number: item.number,
          category: item.category,
          question: item.question,
          evidenceBasis: item.evidenceBasis,
        })),
        questionCount: row.questions.length,
        sourceStatuses: [],
        reportFileName: row.report?.fileName ?? '',
        generatedAt: (row.report?.generatedAt ?? row.updatedAt).toISOString(),
        disclaimer: EWI_RESULT_DISCLAIMER,
      },
    };
  }
}

function parsePublishedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
