import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type InvestigationStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';
import {
  EWI_JOB_STEP_LABELS,
  EWI_STAGE_IDENTIFY,
  EWI_STAGE_REPORT,
} from '../jobs/ewi-investigation-job.constants';
import {
  InvalidInvestigationTransitionError,
  assertInvestigationTransition,
  toStorableFinding,
  type InvestigationLifecycleStatus,
} from '../domain/investigation-lifecycle';
import type { InconsistencySource } from '../../research/inconsistency-analyzer';
import type { VerificationField } from '../../research/verification-labels';
import {
  LEGAL_RESEARCH_PROVIDER_IDS,
  buildLegalResearchDossier,
} from '../../research/legal';
import {
  ONLINE_PRESENCE_PROVIDER_IDS,
  buildOnlinePresenceDossier,
} from '../../research/online-presence';
import {
  PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
  buildProfessionalBackgroundDossier,
} from '../../research/professional-background';

const EWI_RESULT_DISCLAIMER =
  'Expert Witness Investigation output is for attorney research only. Restricted sources are stored as metadata and links only.';

const detailInclude = {
  expert: true,
  profile: true,
  sources: true,
  findings: { include: { source: true } },
  discrepancies: { orderBy: { priority: 'asc' as const } },
  questions: { orderBy: { number: 'asc' as const } },
  report: true,
  analysis: true,
  documents: {
    where: { kind: 'cv' },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { id: true, originalName: true, pageCount: true },
  },
} satisfies Prisma.InvestigationInclude;

type InvestigationDetail = Prisma.InvestigationGetPayload<{
  include: typeof detailInclude;
}>;

export interface InvestigationView {
  id: string;
  jobId: string;
  expertId: string;
  expertName: string;
  city: string;
  specialty: string;
  npi: string | null;
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
  /** The CV uploaded for this investigation (detail views only). */
  cvDocument?: { id: string; name: string; pageCount: number } | null;
}

@Injectable()
export class ExpertInvestigationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    jobId: string,
    dto: CreateExpertInvestigationDto,
    ownerUserId: string,
  ) {
    const name = dto.expertName.trim();
    const city = dto.city.trim();
    const specialty = dto.specialty.trim();

    const created = await this.prisma.$transaction(async (tx) => {
      const expert = await tx.expert.upsert({
        where: { name_city_specialty: { name, city, specialty } },
        create: { name, city, specialty },
        update: {},
      });

      return tx.investigation.create({
        data: {
          jobId,
          expertId: expert.id,
          status: 'pending',
          currentStage: EWI_STAGE_IDENTIFY,
          stageLabel: EWI_JOB_STEP_LABELS[EWI_STAGE_IDENTIFY],
          progress: 0,
          ownerUserId,
          npi: dto.npi ?? null,
          profile: {
            create: { displayName: name, city, specialty },
          },
          events: {
            create: {
              eventType: 'created',
              status: 'pending',
              stage: EWI_STAGE_IDENTIFY,
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

  async findOwned(
    id: string,
    ownerUserId: string,
  ): Promise<InvestigationView | null> {
    const row = await this.prisma.investigation.findFirst({
      where: { id, ownerUserId },
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

  async listForOwner(
    ownerUserId: string,
    limit = 50,
  ): Promise<InvestigationView[]> {
    const rows = await this.prisma.investigation.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { expert: true, report: true },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async ownsJob(jobId: string, ownerUserId: string): Promise<boolean> {
    const row = await this.prisma.investigation.findFirst({
      where: { jobId, ownerUserId },
      select: { id: true },
    });
    return row !== null;
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
    if (
      current.status === 'cancelled' ||
      current.status === 'completed' ||
      current.status === 'failed'
    ) {
      return current;
    }
    if (data.status && data.status !== current.status) {
      this.guardTransition(current.status, data.status);
    }

    const stageChanged =
      data.step !== undefined && data.step !== current.currentStage;

    // Atomic guard: refuse to overwrite a concurrent cancel/complete/fail.
    const updated = await this.prisma.investigation.updateMany({
      where: {
        jobId,
        status: { in: ['pending', 'running'] },
      },
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
      },
    });

    if (updated.count === 0) {
      return this.requireByJobId(jobId);
    }

    if (stageChanged) {
      await this.prisma.investigationEvent.create({
        data: {
          investigationId: current.id,
          eventType: 'stage_changed',
          status: data.status ?? current.status,
          stage: data.step ?? current.currentStage,
          message: data.message ?? data.stepLabel ?? null,
        },
      });
    }

    return this.requireByJobId(jobId);
  }

  async markCompleted(
    jobId: string,
    result: EwiInvestigationResult,
    report: {
      fileName: string;
      mimeType: string;
      storageKey: string;
      byteSize: number;
      templateId?: string;
      templateVersion?: string;
    },
  ) {
    const current = await this.requireByJobId(jobId);
    if (current.status === 'cancelled') return null;
    this.guardTransition(current.status, 'completed');

    const storedFindings = result.evidence.map((item) => {
      const publishedRaw = item.raw?.publishedAt ?? item.raw?.publicationDate;
      const publishedAt = parsePublishedAt(publishedRaw);
      const retrievedAt = parsePublishedAt(
        item.retrievedAt ?? item.source?.retrievedAt,
      );
      return toStorableFinding({
        title: item.title,
        summary: item.summary,
        url: item.url,
        sourceType: item.category,
        sourceName: item.source?.name ?? item.sourceId,
        provider: item.sourceId,
        publishedAt,
        retrievedAt,
        restricted:
          item.access === 'restricted' || item.source?.access === 'restricted',
        attributes: withInformationStatus(item.raw, item.informationStatus),
        identityMatch: item.identityMatch,
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
        const restricted = items.some((item) => item.restricted);
        const source = await tx.researchSource.create({
          data: {
            investigationId: current.id,
            provider,
            sourceType: sourceTypes.size === 1 ? items[0].sourceType : 'mixed',
            name: items[0]?.sourceName || provider,
            url: items.find((item) => item.url)?.url ?? null,
            publishedAt:
              items.find((item) => item.publishedAt)?.publishedAt ?? null,
            retrievedAt:
              items.find((item) => item.retrievedAt)?.retrievedAt ?? null,
            evidenceStatus: items.every(
              (item) => item.evidenceStatus === 'metadata_only',
            )
              ? 'metadata_only'
              : 'recorded',
            restricted,
            restrictionNote: restricted
              ? 'Metadata only. Source license does not permit storing content. LexisNexis PDFs are not stored.'
              : null,
          },
        });

        await tx.researchFinding.createMany({
          data: items.map((item) => ({
            investigationId: current.id,
            sourceId: source.id,
            category: item.category,
            title: item.title,
            summary: item.summary,
            url: item.url,
            sourceType: item.sourceType,
            sourceName: item.sourceName,
            publishedAt: item.publishedAt,
            retrievedAt: item.retrievedAt,
            relevantDates: item.relevantDates,
            evidenceStatus: item.evidenceStatus,
            verificationStatus: 'unverified' as const,
            restricted: item.restricted,
            notes: item.notes,
            attributes:
              item.attributes === null
                ? Prisma.JsonNull
                : (item.attributes as Prisma.InputJsonValue),
          })),
        });
      }

      for (const attempt of result.sourceStatuses ?? []) {
        if (groups.has(attempt.sourceId)) continue;
        const restricted =
          attempt.attemptStatus === 'restricted' ||
          attempt.disposition === 'paid_access';
        await tx.researchSource.create({
          data: {
            investigationId: current.id,
            provider: attempt.sourceId,
            sourceType: 'attempt',
            name: attempt.sourceId,
            retrievedAt: new Date(),
            evidenceStatus: restricted ? 'metadata_only' : 'unavailable',
            restricted,
            restrictionNote: attempt.message ?? null,
          },
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
            sourceName: item.supportingSource,
            sourceUrl: item.relatedUrls[0] ?? null,
            evidenceStatus: 'recorded' as const,
            verificationStatus: storedVerificationStatus(item.label),
            label: item.label,
            field: item.field,
            previousValue: item.previousValue,
            currentValue: item.currentValue,
            changeText: item.change,
            cvDate: item.cvDate,
            cvSource: item.cvSource,
            supportingSource: item.supportingSource,
            priority: item.priority,
            evidence:
              item.sources.length > 0
                ? (item.sources as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
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

      if (result.analysis || (result.sourceStatuses?.length ?? 0) > 0) {
        await tx.investigationAnalysis.create({
          data: {
            investigationId: current.id,
            origin: result.analysis?.origin ?? 'deterministic',
            providerName: result.analysis?.providerName ?? null,
            schemaVersion: result.analysis?.document.schemaVersion ?? '1.1',
            payload: {
              document:
                result.analysis?.document ??
                ({
                  schemaVersion: '1.1',
                  groups: [],
                  duplicates: [],
                  comparisons: [],
                  conflicts: [],
                  missing: [],
                  cvDiscrepancies: [],
                  assessments: [],
                  sectionSummaries: [],
                  investigationFindings: [],
                  summary: result.summary,
                  conclusions: [],
                  questions: [],
                } as unknown as Prisma.InputJsonValue),
              sourceStatuses: result.sourceStatuses ?? [],
              identity: result.identity ?? null,
              cvCheck: result.cvCheck ?? null,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.investigationReport.create({
        data: {
          investigationId: current.id,
          fileName: report.fileName,
          mimeType: report.mimeType,
          storageKey: report.storageKey,
          byteSize: report.byteSize,
          templateId: report.templateId ?? 'ewi/investigation-report',
          templateVersion: report.templateVersion ?? '1.0.0',
          generatedAt: new Date(result.generatedAt),
        },
      });

      const profileSummary = storedFindings.find(
        (item) =>
          !item.restricted &&
          item.identityMatch === 'matched' &&
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
          currentStage: EWI_STAGE_REPORT,
          stageLabel: EWI_JOB_STEP_LABELS[EWI_STAGE_REPORT],
          notes: result.summary,
          message: 'Investigation complete',
          errorMessage: null,
          completedAt: new Date(),
          events: {
            create: {
              eventType: 'completed',
              status: 'completed',
              stage: EWI_STAGE_REPORT,
              message: 'Investigation complete',
            },
          },
        },
      });
    });

    return {
      investigationId: current.id,
      expertId: current.expertId,
    };
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
    if (current.status === 'cancelled') {
      const view = await this.findById(id);
      if (!view) {
        throw new NotFoundException(`Investigation "${id}" not found`);
      }
      return view;
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

  /** Re-assert cancelled after a race with progress updates. */
  async cancelByJobId(jobId: string): Promise<void> {
    const current = await this.prisma.investigation.findUnique({
      where: { jobId },
    });
    if (!current) return;
    if (current.status === 'cancelled') return;
    if (current.status === 'completed' || current.status === 'failed') return;

    await this.prisma.investigation.updateMany({
      where: {
        jobId,
        status: { in: ['pending', 'running'] },
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        message: 'Investigation cancelled',
      },
    });
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
    npi?: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    expert: { name: string; city: string; specialty: string };
    report: { fileName: string; mimeType: string; storageKey: string } | null;
  }): InvestigationView {
    return {
      id: row.id,
      jobId: row.jobId,
      expertId: row.expertId,
      expertName: row.expert.name,
      city: row.expert.city,
      specialty: row.expert.specialty,
      npi: row.npi ?? null,
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
    const cv = row.documents[0];
    const base: InvestigationView = {
      ...this.toListItem(row),
      cvDocument: cv
        ? { id: cv.id, name: cv.originalName, pageCount: cv.pageCount }
        : null,
    };
    if (
      row.findings.length === 0 &&
      row.questions.length === 0 &&
      row.discrepancies.length === 0
    ) {
      return base;
    }

    return {
      ...base,
      result: (() => {
        const evidence = row.findings.map((finding) => {
          const attributes =
            finding.attributes &&
            typeof finding.attributes === 'object' &&
            !Array.isArray(finding.attributes)
              ? (finding.attributes as Record<string, unknown>)
              : undefined;
          return {
            sourceId: finding.source.provider,
            category: finding.sourceType,
            title: finding.title,
            summary: finding.summary ?? '',
            url: finding.url ?? undefined,
            access: finding.restricted
              ? ('restricted' as const)
              : ('public' as const),
            retrievedAt: finding.retrievedAt?.toISOString(),
            raw: attributes,
            informationStatus: readInformationStatus(
              attributes?.informationStatus,
            ),
            identityMatch:
              attributes?.identityMatch === 'matched'
                ? ('matched' as const)
                : attributes?.identityMatch === 'uncertain'
                  ? ('uncertain' as const)
                  : undefined,
          };
        });
        return {
          expertName: row.expert.name,
          city: row.expert.city,
          specialty: row.expert.specialty,
          npi: row.npi ?? null,
          identity: readStoredIdentity(row.analysis?.payload),
          cvCheck: readStoredCvCheck(row.analysis?.payload),
          evidence,
          discrepancies: row.discrepancies.map((item) => ({
            id: item.id,
            severity: item.severity as 'low' | 'medium' | 'high',
            title: item.title,
            description: item.description,
            evidenceIds: [],
            relatedUrls: item.relatedUrls,
            label: item.label,
            field: (item.field ?? 'cv') as VerificationField,
            previousValue: item.previousValue,
            currentValue: item.currentValue,
            change: item.changeText,
            cvDate: item.cvDate,
            cvSource: item.cvSource,
            supportingSource: item.supportingSource,
            priority: item.priority,
            sources: readInconsistencySources(item.evidence),
          })),
          questions: row.questions.map((item) => ({
            number: item.number,
            category: item.category,
            question: item.question,
            evidenceBasis: item.evidenceBasis,
          })),
          questionCount: row.questions.length,
          sourceStatuses: readSourceStatuses(row),
          reportFileName: row.report?.fileName ?? '',
          generatedAt: (row.report?.generatedAt ?? row.updatedAt).toISOString(),
          disclaimer: EWI_RESULT_DISCLAIMER,
          summary: row.notes ?? '',
          legalResearch: buildLegalResearchDossier({
            evidence,
            legalProviderIds: LEGAL_RESEARCH_PROVIDER_IDS,
          }),
          onlinePresence: buildOnlinePresenceDossier({
            evidence,
            presenceProviderIds: ONLINE_PRESENCE_PROVIDER_IDS,
          }),
          professionalBackground: buildProfessionalBackgroundDossier({
            evidence,
            professionalProviderIds: PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
          }),
          analysis: row.analysis
            ? {
                origin: row.analysis.origin === 'ai' ? 'ai' : 'deterministic',
                providerName: row.analysis.providerName,
                document: readAnalysisDocument(row.analysis.payload),
              }
            : {
                origin: 'deterministic',
                providerName: null,
                document: {
                  schemaVersion: '1.1',
                  groups: [],
                  duplicates: [],
                  comparisons: [],
                  conflicts: [],
                  missing: [],
                  cvDiscrepancies: [],
                  assessments: [],
                  sectionSummaries: [],
                  investigationFindings: [],
                  summary:
                    row.notes ?? 'Could not verify. No analysis was stored.',
                  conclusions: [],
                  questions: [],
                },
              },
        };
      })(),
    };
  }
}

function readAnalysisDocument(
  payload: unknown,
): EwiInvestigationResult['analysis']['document'] {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (record.document && typeof record.document === 'object') {
      return record.document as EwiInvestigationResult['analysis']['document'];
    }
    if ('schemaVersion' in record) {
      return payload as EwiInvestigationResult['analysis']['document'];
    }
  }
  return {
    schemaVersion: '1.1',
    groups: [],
    duplicates: [],
    comparisons: [],
    conflicts: [],
    missing: [],
    cvDiscrepancies: [],
    assessments: [],
    sectionSummaries: [],
    investigationFindings: [],
    summary: 'Could not verify. No analysis was stored.',
    conclusions: [],
    questions: [],
  };
}

/** Keeps the collected verification status with the stored attributes. */
function withInformationStatus(
  raw: Record<string, unknown> | undefined,
  status: string | undefined,
): Record<string, unknown> | null {
  if (!raw && !status) return null;
  return status ? { ...(raw ?? {}), informationStatus: status } : (raw ?? null);
}

function readInformationStatus(
  value: unknown,
): 'verified' | 'unverified' | 'conflicting' | 'unavailable' | undefined {
  return value === 'verified' ||
    value === 'unverified' ||
    value === 'conflicting' ||
    value === 'unavailable'
    ? value
    : undefined;
}

function readStoredIdentity(
  payload: unknown,
): EwiInvestigationResult['identity'] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const identity = (payload as Record<string, unknown>).identity;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return null;
  }
  const record = identity as Record<string, unknown>;
  return typeof record.status === 'string' && typeof record.note === 'string'
    ? (identity as NonNullable<EwiInvestigationResult['identity']>)
    : null;
}

function readStoredCvCheck(
  payload: unknown,
): EwiInvestigationResult['cvCheck'] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const check = (payload as Record<string, unknown>).cvCheck;
  if (!check || typeof check !== 'object' || Array.isArray(check)) return null;
  const record = check as Record<string, unknown>;
  return Array.isArray(record.comparisons) && Array.isArray(record.claims)
    ? (check as NonNullable<EwiInvestigationResult['cvCheck']>)
    : null;
}

function readSourceStatuses(
  row: InvestigationDetail,
): EwiInvestigationResult['sourceStatuses'] {
  const fromPayload = readStoredSourceStatuses(row.analysis?.payload);
  if (fromPayload.length > 0) return fromPayload;

  const counts = new Map<string, number>();
  for (const finding of row.findings) {
    const provider = finding.source.provider;
    counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }

  const fromSources = row.sources.map((source) => {
    const itemCount = counts.get(source.provider) ?? 0;
    const restricted = source.restricted;
    const unavailable = source.evidenceStatus === 'unavailable';
    return {
      sourceId: source.provider,
      status: unavailable ? 'unavailable' : restricted ? 'unavailable' : 'ok',
      attemptStatus: restricted
        ? ('restricted' as const)
        : unavailable
          ? ('unavailable' as const)
          : itemCount > 0
            ? ('completed' as const)
            : ('completed' as const),
      disposition: restricted
        ? ('paid_access' as const)
        : unavailable
          ? ('unavailable' as const)
          : ('completed' as const),
      message: source.restrictionNote ?? undefined,
      itemCount,
      checked: true,
    };
  });
  return fromSources;
}

function readStoredSourceStatuses(
  payload: unknown,
): EwiInvestigationResult['sourceStatuses'] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const listed = record.sourceStatuses;
  if (!Array.isArray(listed)) return [];
  return listed.filter(
    (entry): entry is EwiInvestigationResult['sourceStatuses'][number] =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as { sourceId?: unknown }).sourceId === 'string',
  );
}

function parsePublishedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function storedVerificationStatus(
  label: string | undefined,
): 'verified' | 'unverified' | 'disputed' {
  if (label === 'verified') return 'verified';
  if (label === 'conflicting') return 'disputed';
  return 'unverified';
}

function readInconsistencySources(value: unknown): InconsistencySource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.sourceId !== 'string' ||
      typeof row.sourceName !== 'string'
    ) {
      return [];
    }
    return [
      {
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        title: typeof row.title === 'string' ? row.title : row.sourceName,
        url: typeof row.url === 'string' ? row.url : undefined,
        retrievedAt:
          typeof row.retrievedAt === 'string' ? row.retrievedAt : undefined,
        value: typeof row.value === 'string' ? row.value : '',
        cvDate: typeof row.cvDate === 'string' ? row.cvDate : undefined,
      },
    ];
  });
}
