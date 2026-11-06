import { Logger } from '@nestjs/common';
import {
  markConflicts,
  parsePersonName,
  parseYear,
  type ExpertEvidenceItem,
  type ExpertIdentityResolution,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
  type PublicationLookupResult,
  type PublicationQuery,
} from '@integrations/expert-research';
import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import {
  extractStructuredClaimsFromCvText,
  finalizeCvClaims,
  textLooksLikeCurriculumVitae,
} from '../../cv/cv-claims';
import { compareCv, cvDiscrepancies } from '../../cv/cv-comparison';
import type {
  CvCheck,
  CvClaim,
  CvClaimCategory,
  CvExtraction,
} from '../../cv/cv.types';
import { CV_CLAIM_CATEGORIES } from '../../cv/cv.types';
import { DiscrepancyAnalyzer } from '../../research/discrepancy-analyzer';
import type { VerificationAttempt } from '../../research/inconsistency-analyzer';
import {
  LEGAL_RESEARCH_PROVIDER_IDS,
  applyChallengeReadings,
  buildLegalResearchDossier,
  challengeCandidates,
  type ChallengeCandidate,
  type ChallengeReading,
  type LegalResearchDossier,
} from '../../research/legal';
import {
  ONLINE_PRESENCE_PROVIDER_IDS,
  buildOnlinePresenceDossier,
  type OnlinePresenceDossier,
} from '../../research/online-presence';
import {
  PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
  buildProfessionalBackgroundDossier,
  type ProfessionalBackgroundDossier,
} from '../../research/professional-background';
import {
  assessProgramAccreditation,
  educationEntriesFromCvCheck,
  type AccreditationDossier,
  type AccreditationFetchResult,
  type AccreditationSearchHit,
} from '../../research/accreditation';
import {
  assessMemberships,
  membershipEntriesFromCvCheck,
  type MembershipDossier,
  type MembershipFetchResult,
  type MembershipSearchHit,
} from '../../research/memberships';
import {
  assessDirectoryListings,
  type DirectoryAdvertisingDossier,
  type DirectoryFetchResult,
  type DirectorySearchHit,
} from '../../research/directories';
import {
  assessBoardCertifications,
  boardCertificationEntriesFromCvCheck,
  claimedBoardSignals,
  type BoardCertificationDossier,
  type BoardCertificationFetchResult,
  type BoardCertificationSearchHit,
} from '../../research/board-certifications';
import {
  assessInstitutionalAffiliations,
  affiliationEntriesFromCvCheck,
  type AffiliationDossier,
  type AffiliationFetchResult,
  type AffiliationSearchHit,
} from '../../research/affiliations';
import type { EwiPdfReportService } from '../../report/ewi-pdf-report.service';
import {
  buildQuestionDrafts,
  finalizeQuestions,
  type QuestionDraft,
} from '../../report/ewi-report-questions';
import {
  buildAnalysisPacket,
  buildDeterministicAnalysis,
} from '../analysis/deterministic-analysis';
import type {
  AnalysisPacket,
  EwiAnalysisRecord,
} from '../analysis/ewi-analysis.types';
import type {
  EwiInvestigationRequest,
  EwiInvestigationResult,
  EwiProgressUpdate,
  EwiSourceAttemptStatus,
} from '../jobs/ewi-investigation-job.types';
import {
  createResearchPlan,
  type InvestigationStageDefinition,
} from './investigation-stages';
import {
  buildInvestigationSummary,
  type StageNote,
} from './investigation-summary';
import { exponentialBackoffMs, mapProviderAttempt } from './provider-attempt';
import { PublicResearchCache } from './research-cache';

const TRANSIENT_FAILURE =
  /timed out|rate limited|429|502|503|504|econnreset|temporarily/i;

const AUTHORIZED_ACCESS =
  'requires authorized access. No request was sent and restricted content was not stored.';

/** Opinions sent to the model in one request to read Daubert/Frye rulings. */
const MAX_CHALLENGE_READINGS = 8;

export class InvestigationCancelledError extends Error {
  constructor(message = 'Investigation cancelled.') {
    super(message);
    this.name = 'InvestigationCancelledError';
  }
}

/** The research query for a request: the attorney's extra context travels as context. */
export function toResearchQuery(
  request: EwiInvestigationRequest,
  options: {
    knownBoardCertificationAcronyms?: string[];
    knownBoardCertificationHosts?: string[];
  } = {},
): ExpertResearchQuery {
  const { additionalContext, ...rest } = request;
  return {
    ...rest,
    ...(additionalContext ? { context: additionalContext } : {}),
    ...(options.knownBoardCertificationAcronyms?.length
      ? {
          knownBoardCertificationAcronyms:
            options.knownBoardCertificationAcronyms,
        }
      : {}),
    ...(options.knownBoardCertificationHosts?.length
      ? {
          knownBoardCertificationHosts: options.knownBoardCertificationHosts,
        }
      : {}),
  };
}

export interface InvestigationResearchPort {
  /** The shared global web research for this subject (memoized). Optional. */
  webDossier?(query: ExpertResearchQuery): Promise<WebResearchDossier | null>;
  collectProviders(
    query: ExpertResearchQuery,
    providerIds: readonly ExpertResearchProviderId[],
  ): Promise<ExpertResearchSourceResult[]>;
  /** Checks CV publication citations against publication catalogs. Optional. */
  lookupPublications?(
    expertName: string,
    citations: Array<string | PublicationQuery>,
  ): Promise<PublicationLookupResult[]>;
}

export interface InvestigationWorkflowCheckpoint {
  completedStageIds: string[];
  sourceResults: ExpertResearchSourceResult[];
  evidence: ExpertEvidenceItem[];
  stageNotes: StageNote[];
}

export interface InvestigationWorkflowDependencies {
  research: InvestigationResearchPort;
  report: Pick<EwiPdfReportService, 'build'>;
  analyze?: (packet: AnalysisPacket) => Promise<EwiAnalysisRecord>;
  /** Reads the claims in the uploaded CV (AI). Optional. */
  readCv?: (
    documentId: string,
    onProgress: (message: string) => Promise<void>,
  ) => Promise<CvExtraction | null>;
  /** Reads Daubert/Frye rulings from opinion excerpts (AI). Optional. */
  /** Tightens question wording with a model; rewrites are validated. Optional. */
  polishQuestions?: (drafts: QuestionDraft[]) => Promise<QuestionDraft[]>;
  readChallengeRulings?: (input: {
    expertName: string;
    surname: string;
    candidates: ChallengeCandidate[];
  }) => Promise<ChallengeReading[]>;
  onProgress?: (update: EwiProgressUpdate) => void | Promise<void>;
  onCheckpoint?: (
    checkpoint: InvestigationWorkflowCheckpoint,
  ) => void | Promise<void>;
  /** Return false to stop the workflow (cancellation). */
  shouldContinue?: () => boolean | Promise<boolean>;
  logger?: Pick<Logger, 'log' | 'warn'>;
  stages?: readonly InvestigationStageDefinition[];
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Resume from a prior checkpoint when practical. */
  checkpoint?: InvestigationWorkflowCheckpoint;
  researchCache?: PublicResearchCache;
  /** Optional SERP for accreditation look-ups after CV education is known. */
  searchAccreditation?: (
    query: string,
  ) => Promise<AccreditationSearchHit[]>;
  /** Optional page fetch for official accreditor URLs. */
  fetchAccreditationPage?: (
    url: string,
  ) => Promise<AccreditationFetchResult | null>;
  /** Optional SERP for membership directory look-ups after CV memberships are known. */
  searchMembership?: (query: string) => Promise<MembershipSearchHit[]>;
  /** Optional page fetch for official membership directory URLs. */
  fetchMembershipPage?: (
    url: string,
  ) => Promise<MembershipFetchResult | null>;
  /** Optional SERP for expert-witness / IME advertising directory look-ups. */
  searchDirectory?: (query: string) => Promise<DirectorySearchHit[]>;
  /** Optional page fetch for advertising directory profile URLs. */
  fetchDirectoryPage?: (
    url: string,
  ) => Promise<DirectoryFetchResult | null>;
  /** Optional SERP for issuing-board certification look-ups. */
  searchBoardCertification?: (
    query: string,
  ) => Promise<BoardCertificationSearchHit[]>;
  /** Optional page fetch for official board verification URLs. */
  fetchBoardCertificationPage?: (
    url: string,
  ) => Promise<BoardCertificationFetchResult | null>;
  /** Optional SERP for institution-scoped affiliation / faculty look-ups. */
  searchAffiliation?: (query: string) => Promise<AffiliationSearchHit[]>;
  /** Optional page fetch for institutional directory / training URLs. */
  fetchAffiliationPage?: (
    url: string,
  ) => Promise<AffiliationFetchResult | null>;
}

export interface InvestigationWorkflowOutcome {
  result: EwiInvestigationResult;
  report: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    templateId?: string;
    templateVersion?: string;
  };
}

export function isTransientResearchFailure(
  result: ExpertResearchSourceResult,
): boolean {
  return (
    result.status === 'error' && TRANSIENT_FAILURE.test(result.message ?? '')
  );
}

export function describeResearchStage(
  stage: InvestigationStageDefinition,
  results: ExpertResearchSourceResult[],
): string {
  if (stage.providers.length === 0) {
    return 'No source is connected for this stage. Nothing was inferred.';
  }

  const attempts = results.map((result) => mapProviderAttempt(result));
  const parts: string[] = [];
  const restricted = attempts.filter(
    (attempt) => attempt.attemptStatus === 'restricted',
  );
  const blocked = restricted.filter(
    (attempt) =>
      attempt.coverage === 'blocked_or_access_denied' &&
      attempt.checked &&
      attempt.access !== 'restricted',
  );
  const neverSent = attempts.filter(
    (attempt) =>
      attempt.access === 'restricted' &&
      !attempt.checked &&
      !blocked.some((entry) => entry.sourceId === attempt.sourceId),
  );
  if (blocked.length > 0) {
    const names = blocked.map((attempt) => attempt.sourceId).join(', ');
    parts.push(
      `${names} could not be read (access wall, login, or bot protection). No request was treated as a negative finding.`,
    );
  }
  if (neverSent.length > 0) {
    const names = neverSent.map((attempt) => attempt.sourceId).join(', ');
    parts.push(`${names} ${AUTHORIZED_ACCESS}`);
  }

  const failed = attempts.filter(
    (attempt) => attempt.attemptStatus === 'failed',
  );
  if (failed.length > 0) {
    parts.push(
      `${failed.length} source(s) failed (${failed
        .map((attempt) => attempt.message ?? attempt.sourceId)
        .join('; ')}). Continuing with the remaining stages.`,
    );
  }

  const unavailable = attempts.filter(
    (attempt) =>
      attempt.attemptStatus === 'unavailable' &&
      attempt.coverage !== 'not_implemented' &&
      attempt.coverage !== 'not_configured',
  );
  const skipped = attempts.filter(
    (attempt) => attempt.attemptStatus === 'skipped',
  );
  const completed = attempts.filter(
    (attempt) => attempt.attemptStatus === 'completed',
  );
  const none = attempts.filter(
    (attempt) => attempt.coverage === 'searched_no_results',
  );
  if (none.length > 0) {
    parts.push(
      `${none.length} source(s) were searched and returned no matching record. That is not evidence of absence.`,
    );
  }
  const unimplemented = attempts.filter(
    (attempt) =>
      (attempt.coverage === 'not_implemented' ||
        attempt.coverage === 'not_configured') &&
      !neverSent.some((entry) => entry.sourceId === attempt.sourceId),
  );
  if (unimplemented.length > 0) {
    parts.push(
      `${unimplemented.length} source(s) were not searched (${unimplemented
        .map((attempt) =>
          attempt.coverage === 'not_configured'
            ? `${attempt.sourceId} not configured`
            : `${attempt.sourceId} not implemented`,
        )
        .join(', ')}). No missing record was treated as a negative finding.`,
    );
  } else if (unavailable.length > 0) {
    parts.push(
      `${unavailable.length} source(s) unavailable. No missing record was treated as a negative finding.`,
    );
  }
  if (skipped.length > 0) {
    parts.push(
      `${skipped.length} source(s) skipped to avoid duplicate searches.`,
    );
  }

  const items = results.flatMap((result) => result.items);
  if (items.length === 0 && completed.length === 0) {
    parts.push('No results.');
  } else if (items.length === 0) {
    parts.push(
      `${completed.length} source(s) checked with no collected items.`,
    );
  } else {
    const conflicting = items.filter(
      (item) => item.informationStatus === 'conflicting',
    ).length;
    parts.push(
      `${items.length} item(s) collected${conflicting > 0 ? `, ${conflicting} conflicting` : ''}.`,
    );
  }

  return parts.join(' ');
}

export async function executeInvestigationWorkflow(
  request: EwiInvestigationRequest,
  dependencies: InvestigationWorkflowDependencies,
): Promise<InvestigationWorkflowOutcome> {
  const stages = dependencies.stages ?? createResearchPlan(request);
  const logger = dependencies.logger;
  const maxAttempts = dependencies.maxAttempts ?? 3;
  const retryDelayMs = dependencies.retryDelayMs ?? 200;
  const sleep =
    dependencies.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const analyzer = new DiscrepancyAnalyzer();
  const cache = dependencies.researchCache;
  const completedStageIds = new Set(
    dependencies.checkpoint?.completedStageIds ?? [],
  );
  const stageNotes: StageNote[] = [
    ...(dependencies.checkpoint?.stageNotes ?? []),
  ];
  const sourceResults: ExpertResearchSourceResult[] = [
    ...(dependencies.checkpoint?.sourceResults ?? []),
  ];
  let evidence: ExpertEvidenceItem[] = [
    ...(dependencies.checkpoint?.evidence ?? []),
  ];
  const collectedProviders = new Set(
    sourceResults.map((result) => result.sourceId),
  );
  let analysisRecord: EwiAnalysisRecord | undefined;
  let legalResearch: LegalResearchDossier | undefined;
  let onlinePresence: OnlinePresenceDossier | undefined;
  let professionalBackground: ProfessionalBackgroundDossier | undefined;
  let cvCheck: CvCheck | null | undefined;

  const ensureAnalysis = async (): Promise<EwiAnalysisRecord> => {
    if (analysisRecord) return analysisRecord;
    const packet = buildAnalysisPacket({
      expertName: request.expertName,
      specialty: request.specialty,
      evidence,
      sourceResults,
    });
    analysisRecord = dependencies.analyze
      ? await dependencies.analyze(packet)
      : {
          origin: 'deterministic',
          providerName: null,
          document: buildDeterministicAnalysis(packet),
        };
    return analysisRecord;
  };

  const persistCheckpoint = async (stageId: string): Promise<void> => {
    completedStageIds.add(stageId);
    await dependencies.onCheckpoint?.({
      completedStageIds: [...completedStageIds],
      sourceResults: [...sourceResults],
      evidence: [...evidence],
      stageNotes: [...stageNotes],
    });
  };

  const assertRunning = async (): Promise<void> => {
    if (!dependencies.shouldContinue) return;
    const ok = await dependencies.shouldContinue();
    if (!ok) throw new InvestigationCancelledError();
  };

  for (let index = 0; index < stages.length; index++) {
    await assertRunning();
    const stage = stages[index];
    const progress = Math.max(
      1,
      Math.round(((index + 1) / stages.length) * 100),
    );

    if (completedStageIds.has(stage.id)) {
      logger?.log(`EWI stage ${stage.id} resumed (already completed)`);
      await report(
        dependencies,
        stage,
        progress,
        `Resumed after ${stage.label}. Stage already completed.`,
      );
      continue;
    }

    logger?.log(`EWI stage ${stage.id} started for ${request.expertName}`);
    await report(
      dependencies,
      stage,
      Math.max(1, Math.round((index / stages.length) * 100)),
      `${stage.label}…`,
    );

    if (stage.kind === 'identify') {
      const name = request.expertName?.trim() ?? '';
      const city = request.city?.trim() ?? '';
      const specialty = request.specialty?.trim() ?? '';
      if (name.length < 2 || specialty.length < 2) {
        throw new Error(
          'A name and a specialty or profession are required to start an investigation.',
        );
      }
      const message = `Identified ${name}${city ? ` in ${city}` : ''} (${specialty})${request.npi ? ` with NPI ${request.npi}` : ''}. Research plan created with ${stages.filter((item) => item.kind === 'research').length} research stages. Identity is confirmed against the NPI Registry before other sources are attributed.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'research') {
      const results = await runResearchStage(
        stage,
        request,
        dependencies,
        maxAttempts,
        retryDelayMs,
        sleep,
        collectedProviders,
        cache,
        (message) => report(dependencies, stage, progress, message),
      );
      for (const result of results) {
        collectedProviders.add(result.sourceId);
      }
      sourceResults.push(...results);
      evidence.push(
        ...results.flatMap((result) =>
          result.items.filter((item) => item.identityMatch !== 'uncertain'),
        ),
      );
      const uncertain = results
        .flatMap((result) => result.items)
        .filter((item) => item.identityMatch === 'uncertain').length;
      const message =
        describeResearchStage(stage, results) +
        (uncertain > 0
          ? ` ${uncertain} uncertain identity match(es) were kept separate and not merged.`
          : '');
      stageNotes.push({ label: stage.label, message });
      logger?.log(`EWI stage ${stage.id}: ${message}`);
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'cross-check') {
      evidence = markConflicts(evidence);
      const conflicting = evidence.filter(
        (item) => item.informationStatus === 'conflicting',
      ).length;
      const message =
        conflicting > 0
          ? `Cross-check complete. ${conflicting} collected item(s) disagree. Identity matches were re-checked. No new records were created.`
          : 'Cross-check complete. No conflicts were found among collected items. Identity matches were re-checked. No new records were created.';
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'discrepancy') {
      cvCheck = await buildCvCheck(
        request,
        evidence,
        sourceResults,
        dependencies,
      );
      const found = [
        ...analyzer.analyze(evidence, verificationAttempts(sourceResults)),
        ...(cvCheck ? cvDiscrepancies(cvCheck) : []),
      ];
      const cvNotes = found.filter(
        (item) =>
          /cv/i.test(item.title) ||
          /cv/i.test(item.description) ||
          item.cvSource != null,
      ).length;
      const significant = found.filter(
        (item) => item.severity === 'high',
      ).length;
      const message =
        found.length === 0
          ? cvCheck
            ? 'No inconsistency was identified from the collected statements, including CV comparisons. Nothing was inferred.'
            : 'No inconsistency was identified from the collected statements. CV comparison was not performed because no readable CV was uploaded. That is not a finding that there are no CV discrepancies.'
          : `${found.length} inconsistency note(s) from source comparison (${cvNotes} CV-related), ${significant} significant.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'analyze-legal') {
      const rulings = await readChallengeRulings(
        request,
        evidence,
        dependencies,
      );
      evidence = rulings.evidence;
      legalResearch = buildLegalResearchDossier({
        evidence,
        sourceResults,
        legalProviderIds: LEGAL_RESEARCH_PROVIDER_IDS,
      });
      const challengeCount = legalResearch.challenges.length;
      const message =
        (legalResearch.matters.length === 0
          ? 'Legal analysis complete. No legal matter was confirmed in the sources and pages retrieved. This is not proof that none exist; see the source coverage list.'
          : `Legal analysis complete. ${legalResearch.matters.length} matter(s), ${legalResearch.orders.length} order(s), ${legalResearch.depositions.length} deposition(s).`) +
        (challengeCount > 0
          ? ` ${challengeCount} opinion(s) mention an admissibility challenge (Daubert, Frye, Rule 702); ${rulings.determined} ruling(s) were read from the court's own words and the rest were not determined.`
          : '');
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'analyze-presence') {
      onlinePresence = buildOnlinePresenceDossier({
        evidence,
        sourceResults,
        presenceProviderIds: ONLINE_PRESENCE_PROVIDER_IDS,
      });
      const message =
        onlinePresence.records.length === 0
          ? 'Online presence analysis complete. No public presence record was confirmed in the pages retrieved. This is not proof that none exist; see the source coverage list.'
          : `Online presence analysis complete. ${onlinePresence.records.length} record(s) grouped.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'analyze-financial') {
      professionalBackground = buildProfessionalBackgroundDossier({
        evidence,
        sourceResults,
        professionalProviderIds: PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
      });
      const message =
        professionalBackground.financial.length === 0 &&
        professionalBackground.records.length === 0
          ? 'Income/bias analysis complete. No public financial or professional background record was confirmed in the sources retrieved; this is not proof that none exist. Percentages were not estimated.'
          : `Income/bias and professional background analysis complete. ${professionalBackground.financial.length} financial record(s), ${professionalBackground.records.length} professional record(s). Percentages shown only when stated.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'summary') {
      const analysis = await ensureAnalysis();
      stageNotes.push({
        label: stage.label,
        message: `Summary ${analysis.origin === 'ai' ? 'phrased from collected findings' : 'built from collected findings only'}.`,
      });
      await report(
        dependencies,
        stage,
        progress,
        analysis.origin === 'ai'
          ? 'Summary phrased from collected findings. Source records were kept unchanged.'
          : 'Summary built from collected findings only.',
      );
      await persistCheckpoint(stage.id);
      continue;
    }

    if (stage.kind === 'questions') {
      await report(
        dependencies,
        stage,
        progress,
        'Generating cross-examination questions from collected items…',
      );
      await persistCheckpoint(stage.id);
      continue;
    }

    await report(dependencies, stage, progress, 'Building the PDF report…');
    await persistCheckpoint(stage.id);
  }

  await assertRunning();

  const analysis = await ensureAnalysis();
  const summary =
    analysis.document.summary ||
    buildInvestigationSummary({
      expertName: request.expertName,
      city: request.city,
      specialty: request.specialty,
      evidence,
      stageNotes,
    });
  if (cvCheck === undefined) {
    cvCheck = await buildCvCheck(
      request,
      evidence,
      sourceResults,
      dependencies,
    );
  }
  const discrepancies = [
    ...analyzer.analyze(evidence, verificationAttempts(sourceResults)),
    ...(cvCheck ? cvDiscrepancies(cvCheck) : []),
  ];
  legalResearch =
    legalResearch ??
    buildLegalResearchDossier({
      evidence,
      sourceResults,
      legalProviderIds: LEGAL_RESEARCH_PROVIDER_IDS,
    });
  onlinePresence =
    onlinePresence ??
    buildOnlinePresenceDossier({
      evidence,
      sourceResults,
      presenceProviderIds: ONLINE_PRESENCE_PROVIDER_IDS,
    });
  professionalBackground =
    professionalBackground ??
    buildProfessionalBackgroundDossier({
      evidence,
      sourceResults,
      professionalProviderIds: PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
    });
  const sourceStatuses: EwiSourceAttemptStatus[] = sourceResults.map(
    (resultItem) => {
      const skipped = /already collected/i.test(resultItem.message ?? '');
      const attempt = mapProviderAttempt(resultItem, { skipped });
      return {
        sourceId: resultItem.sourceId,
        status: resultItem.status,
        attemptStatus: attempt.attemptStatus,
        disposition: attempt.disposition,
        outcome: resultItem.outcome,
        coverage: attempt.coverage,
        message: resultItem.message,
        itemCount: resultItem.items.length,
        checked: attempt.checked,
        retrievedAt: resultItem.retrievedAt,
      };
    },
  );
  const drafts = buildQuestionDrafts({
    expertName: request.expertName,
    evidence,
    discrepancies,
    cvCheck,
    sourceStatuses,
  });
  let worded = drafts;
  if (dependencies.polishQuestions && drafts.length > 0) {
    try {
      worded = await dependencies.polishQuestions(drafts);
    } catch (error) {
      dependencies.logger?.warn(
        `Question wording kept as drafted: ${error instanceof Error ? error.message : 'rewrite failed'}`,
      );
    }
  }
  const questions = finalizeQuestions(worded);
  const generatedAt = new Date().toISOString();
  const identity = identityFromResearch(request, sourceResults, evidence);
  let webResearch: WebResearchDossier | null = null;
  if (dependencies.research.webDossier) {
    try {
      const boardEntries = cvCheck
        ? boardCertificationEntriesFromCvCheck(cvCheck)
        : [];
      const boardSignals = claimedBoardSignals(
        boardEntries
          .map((e) => e.boardId)
          .filter((id): id is string => Boolean(id)),
      );
      webResearch = await dependencies.research.webDossier(
        toResearchQuery(request, {
          knownBoardCertificationAcronyms: boardSignals.acronyms,
          knownBoardCertificationHosts: boardSignals.hosts,
        }),
      );
    } catch (error) {
      dependencies.logger?.warn(
        `Web research dossier unavailable for the report: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
  // If intake had no uploaded CV, compare claims from a public CV/resume PDF
  // found on the expert’s own site during web research.
  if (!cvCheck && webResearch) {
    const websiteExtraction = extractionFromWebsiteCv(
      webResearch,
      request.expertName,
    );
    if (websiteExtraction) {
      try {
        const citations: PublicationQuery[] = websiteExtraction.claims
          .filter(
            (claim) => claim.category === 'publication' && claim.details.title,
          )
          .map((claim) => ({
            title: claim.details.title!,
            citation: claim.statement,
            journal: claim.details.journal,
            year: parseYear(claim.details.year) ?? parseYear(claim.statement),
            doi: claim.details.doi,
            pmid: claim.details.pmid,
            type: claim.details.publicationType as PublicationQuery['type'],
          }));
        let publications: PublicationLookupResult[] = [];
        if (citations.length > 0 && dependencies.research.lookupPublications) {
          try {
            publications = await dependencies.research.lookupPublications(
              request.expertName,
              citations,
            );
          } catch (error) {
            dependencies.logger?.warn(
              `Website CV publication lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
            );
          }
        }
        cvCheck = compareCv({
          extraction: websiteExtraction,
          evidence,
          sourceResults,
          identity: identityFromResearch(request, sourceResults, evidence),
          publications,
          expertName: request.expertName,
        });
        // Replace the early "no uploaded CV" status once a public CV was compared.
        const cvStatusIndex = sourceStatuses.findIndex(
          (status) => status.sourceId === 'cv_profile',
        );
        const comparedMessage = `Public CV located at ${websiteExtraction.document.id}. Parsed successfully; ${websiteExtraction.claims.length} claim(s) extracted and compared. Credentials stated only on the CV remain self-reported.`;
        if (cvStatusIndex >= 0) {
          sourceStatuses[cvStatusIndex] = {
            ...sourceStatuses[cvStatusIndex],
            checked: true,
            status: 'ok',
            message: comparedMessage,
            itemCount: websiteExtraction.claims.length,
          };
        }
      } catch (error) {
        dependencies.logger?.warn(
          `Website CV comparison failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    } else {
      const foundUrls = publicCvCandidateUrls(webResearch, request.expertName);
      const unparsedUrls = publicCvFoundUnparsed(
        webResearch,
        request.expertName,
      );
      const cvStatusIndex = sourceStatuses.findIndex(
        (status) => status.sourceId === 'cv_profile',
      );
      if (cvStatusIndex >= 0 && unparsedUrls.length > 0) {
        sourceStatuses[cvStatusIndex] = {
          ...sourceStatuses[cvStatusIndex],
          message: `A public CV was located (${unparsedUrls.slice(0, 3).join('; ')}) and the document was retrieved, but usable claims could not be extracted for comparison. Upload a readable CV to compare. That is not a finding that the expert has no CV discrepancies.`,
        };
      } else if (cvStatusIndex >= 0 && foundUrls.length > 0) {
        sourceStatuses[cvStatusIndex] = {
          ...sourceStatuses[cvStatusIndex],
          message: `A public CV or resume URL was found (${foundUrls.slice(0, 3).join('; ')}) but could not be read or parsed for comparison (login, CAPTCHA, empty PDF text, or thin page). Upload the CV to compare. That is not a finding that the expert has no CV discrepancies.`,
        };
      }
    }
  }
  let accreditation: AccreditationDossier | null = null;
  if (cvCheck) {
    try {
      const entries = educationEntriesFromCvCheck(cvCheck);
      if (entries.length > 0) {
        accreditation = await assessProgramAccreditation({
          entries,
          specialty: request.specialty,
          dossier: webResearch,
          search: dependencies.searchAccreditation,
          fetchPage: dependencies.fetchAccreditationPage,
        });
      }
    } catch (error) {
      dependencies.logger?.warn(
        `Accreditation assessment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  let membershipAssessments: MembershipDossier | null = null;
  if (cvCheck) {
    try {
      const membershipEntries = membershipEntriesFromCvCheck(cvCheck);
      if (membershipEntries.length > 0) {
        membershipAssessments = await assessMemberships({
          entries: membershipEntries,
          expertName: request.expertName,
          specialty: request.specialty,
          city: request.city,
          dossier: webResearch,
          search: dependencies.searchMembership,
          fetchPage: dependencies.fetchMembershipPage,
        });
      }
    } catch (error) {
      dependencies.logger?.warn(
        `Membership assessment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  let directoryAssessments: DirectoryAdvertisingDossier | null = null;
  try {
    directoryAssessments = await assessDirectoryListings({
      expertName: request.expertName,
      specialty: request.specialty,
      city: request.city,
      dossier: webResearch,
      search: dependencies.searchDirectory,
      fetchPage: dependencies.fetchDirectoryPage,
    });
  } catch (error) {
    dependencies.logger?.warn(
      `Directory advertising assessment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  let boardCertificationAssessments: BoardCertificationDossier | null = null;
  if (cvCheck) {
    try {
      const boardEntries = boardCertificationEntriesFromCvCheck(cvCheck);
      if (boardEntries.length > 0) {
        boardCertificationAssessments = await assessBoardCertifications({
          entries: boardEntries,
          expertName: request.expertName,
          specialty: request.specialty,
          city: request.city,
          dossier: webResearch,
          search: dependencies.searchBoardCertification,
          fetchPage: dependencies.fetchBoardCertificationPage,
        });
      }
    } catch (error) {
      dependencies.logger?.warn(
        `Board certification assessment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  let affiliationAssessments: AffiliationDossier | null = null;
  if (cvCheck) {
    try {
      const affiliationEntries = affiliationEntriesFromCvCheck(cvCheck);
      if (affiliationEntries.length > 0) {
        affiliationAssessments = await assessInstitutionalAffiliations({
          entries: affiliationEntries,
          expertName: request.expertName,
          specialty: request.specialty,
          city: request.city,
          dossier: webResearch,
          search: dependencies.searchAffiliation,
          fetchPage: dependencies.fetchAffiliationPage,
        });
      }
    } catch (error) {
      dependencies.logger?.warn(
        `Affiliation assessment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  // Re-compare CV so §8 labels reflect board/affiliation assessments.
  if (
    cvCheck &&
    ((boardCertificationAssessments?.assessments.length ?? 0) > 0 ||
      (affiliationAssessments?.assessments.length ?? 0) > 0)
  ) {
    try {
      const citations: PublicationQuery[] = cvCheck.claims
        .filter(
          (claim) => claim.category === 'publication' && claim.details.title,
        )
        .map((claim) => ({
          title: claim.details.title!,
          citation: claim.statement,
          journal: claim.details.journal,
          year: parseYear(claim.details.year) ?? parseYear(claim.statement),
          doi: claim.details.doi,
          pmid: claim.details.pmid,
          type: claim.details.publicationType as PublicationQuery['type'],
        }));
      let publications: PublicationLookupResult[] = [];
      if (citations.length > 0 && dependencies.research.lookupPublications) {
        try {
          publications = await dependencies.research.lookupPublications(
            request.expertName,
            citations,
          );
        } catch (error) {
          dependencies.logger?.warn(
            `CV publication re-lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }
      cvCheck = compareCv({
        extraction: {
          document: cvCheck.document,
          status: cvCheck.status,
          claims: cvCheck.claims,
          warnings: cvCheck.warnings,
          ...(cvCheck.incompletePages?.length
            ? { incompletePages: cvCheck.incompletePages }
            : {}),
        },
        evidence,
        sourceResults,
        identity,
        publications,
        expertName: request.expertName,
        boardCertificationAssessments:
          boardCertificationAssessments?.assessments ?? null,
        affiliationAssessments: affiliationAssessments?.assessments ?? null,
      });
      // Refresh CV-driven discrepancies only; keep analyzer discrepancies.
      const nonCv = discrepancies.filter(
        (item) => !String(item.id ?? '').startsWith('cv-check-'),
      );
      discrepancies.length = 0;
      discrepancies.push(...nonCv, ...cvDiscrepancies(cvCheck));
    } catch (error) {
      dependencies.logger?.warn(
        `CV re-compare with assessments failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  const reportArtifact = await dependencies.report.build({
    expertName: request.expertName,
    city: request.city,
    specialty: request.specialty,
    additionalContext: request.additionalContext ?? null,
    webResearch,
    evidence,
    discrepancies,
    questions,
    generatedAt,
    summary,
    analysis: analysis.document,
    legalResearch,
    onlinePresence,
    professionalBackground,
    identity,
    cvCheck,
    accreditation,
    membershipAssessments,
    directoryAssessments,
    boardCertificationAssessments,
    affiliationAssessments,
    sourceStatuses,
  });

  const result: EwiInvestigationResult = {
    expertName: request.expertName,
    city: request.city,
    specialty: request.specialty,
    npi: request.npi ?? null,
    additionalContext: request.additionalContext ?? null,
    webResearch,
    identity,
    cvCheck: cvCheck ?? null,
    accreditation,
    membershipAssessments,
    directoryAssessments,
    boardCertificationAssessments,
    affiliationAssessments,
    evidence,
    discrepancies,
    questions,
    questionCount: questions.length,
    summary,
    analysis,
    legalResearch,
    onlinePresence,
    professionalBackground,
    sourceStatuses,
    reportFileName: reportArtifact.fileName,
    generatedAt,
    disclaimer:
      'Expert Witness Investigation output is for attorney research only. Unavailable sources are not evidence that a credential is absent. Development fixtures are unverified. A source is marked completed only when it was actually checked.',
  };

  logger?.log(
    `EWI workflow finished for ${request.expertName}: ${evidence.length} items, ${questions.length} questions, ${sourceStatuses.filter((item) => item.checked).length} providers checked`,
  );

  return {
    result,
    report: {
      fileName: reportArtifact.fileName,
      mimeType: reportArtifact.mimeType,
      buffer: reportArtifact.buffer,
      templateId: reportArtifact.templateId,
      templateVersion: reportArtifact.templateVersion,
    },
  };
}

async function runResearchStage(
  stage: InvestigationStageDefinition,
  request: EwiInvestigationRequest,
  dependencies: InvestigationWorkflowDependencies,
  maxAttempts: number,
  retryDelayMs: number,
  sleep: (ms: number) => Promise<void>,
  alreadyCollected: ReadonlySet<string>,
  cache: PublicResearchCache | undefined,
  notify?: (message: string) => Promise<void>,
): Promise<ExpertResearchSourceResult[]> {
  if (stage.providers.length === 0) return [];

  const query = toResearchQuery(request);
  const skipped: ExpertResearchSourceResult[] = [];
  const pending = new Set<ExpertResearchProviderId>();
  const finished = new Map<string, ExpertResearchSourceResult>();

  // The uploaded CV is this investigation's own document: read it here, and
  // never take it from the shared research cache.
  if (
    stage.providers.includes('cv_profile') &&
    !alreadyCollected.has('cv_profile')
  ) {
    if (request.cvDocumentId && dependencies.readCv) {
      finished.set(
        'cv_profile',
        await readCvSource(request, dependencies, notify),
      );
    } else if (!request.cvDocumentId) {
      finished.set('cv_profile', {
        sourceId: 'cv_profile',
        status: 'unavailable',
        outcome: 'unavailable',
        access: 'public',
        message:
          'No CV was uploaded. CV comparison was not performed. That is not a finding that the expert has no CV discrepancies.',
        retrievedAt: new Date().toISOString(),
        items: [],
      });
    }
  }

  for (const providerId of stage.providers) {
    if (finished.has(providerId)) continue;
    if (alreadyCollected.has(providerId)) {
      const skip = failedResult(
        providerId,
        'Skipped. Already collected in this investigation.',
      );
      skip.status = 'no_result';
      skip.outcome = 'no_result';
      skipped.push(skip);
      continue;
    }
    const cached = cache?.get(query, providerId);
    if (cached) {
      finished.set(providerId, cached);
      continue;
    }
    pending.add(providerId);
  }

  for (let attempt = 1; attempt <= maxAttempts && pending.size > 0; attempt++) {
    if (dependencies.shouldContinue) {
      const ok = await dependencies.shouldContinue();
      if (!ok) throw new InvestigationCancelledError();
    }

    let batch: ExpertResearchSourceResult[];
    try {
      batch = await dependencies.research.collectProviders(query, [...pending]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Research stage failed';
      dependencies.logger?.warn(
        `EWI stage ${stage.id} attempt ${attempt} failed: ${message}`,
      );
      if (attempt >= maxAttempts) {
        for (const sourceId of pending) {
          finished.set(sourceId, failedResult(sourceId, message));
        }
        pending.clear();
        break;
      }
      await sleep(exponentialBackoffMs(retryDelayMs, attempt));
      continue;
    }

    for (const result of batch) {
      if (isTransientResearchFailure(result) && attempt < maxAttempts) {
        continue;
      }
      finished.set(result.sourceId, result);
      pending.delete(result.sourceId);
      cache?.set(query, result);
    }

    if (pending.size > 0 && attempt < maxAttempts) {
      dependencies.logger?.warn(
        `EWI stage ${stage.id} retrying ${[...pending].join(', ')} after a transient failure (backoff)`,
      );
      await sleep(exponentialBackoffMs(retryDelayMs, attempt));
    }
  }

  for (const sourceId of pending) {
    finished.set(
      sourceId,
      failedResult(sourceId, 'Source did not return a result.'),
    );
  }

  const ordered = stage.providers.map((sourceId) => {
    const skippedHit = skipped.find((item) => item.sourceId === sourceId);
    if (skippedHit) return skippedHit;
    return (
      finished.get(sourceId) ??
      failedResult(sourceId, 'Source did not return a result.')
    );
  });

  return ordered.map((result) => {
    if (
      result.message?.includes('Already collected') ||
      (alreadyCollected.has(result.sourceId) &&
        result.message?.includes('Skipped'))
    ) {
      return result;
    }
    return result;
  });
}

/**
 * Reads Daubert/Frye rulings and writes only validated readings back into
 * the evidence, so a resumed investigation keeps them.
 */
async function readChallengeRulings(
  request: EwiInvestigationRequest,
  evidence: ExpertEvidenceItem[],
  dependencies: InvestigationWorkflowDependencies,
): Promise<{ evidence: ExpertEvidenceItem[]; determined: number }> {
  const surname = parsePersonName(request.expertName)?.last;
  const candidates = challengeCandidates(evidence, MAX_CHALLENGE_READINGS);
  if (
    !surname ||
    candidates.length === 0 ||
    !dependencies.readChallengeRulings
  ) {
    return { evidence, determined: 0 };
  }
  try {
    const readings = await dependencies.readChallengeRulings({
      expertName: request.expertName,
      surname,
      candidates,
    });
    return applyChallengeReadings(evidence, candidates, readings, surname);
  } catch (error) {
    dependencies.logger?.warn(
      `EWI challenge rulings were not read: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return { evidence, determined: 0 };
  }
}

/** The NPI Registry identity result, or a development-fixture stand-in. */
export function identityFromResearch(
  request: EwiInvestigationRequest,
  sourceResults: ExpertResearchSourceResult[],
  evidence: ExpertEvidenceItem[],
): ExpertIdentityResolution | null {
  const registry = sourceResults.find(
    (result) => result.sourceId === 'npi_registry',
  );
  if (registry?.identity) return registry.identity;
  const fixture = evidence.find(
    (item) =>
      item.sourceId === 'npi_registry' &&
      item.simulated === true &&
      typeof item.raw?.npi === 'string',
  );
  if (fixture) {
    return {
      status: 'confirmed',
      identity: {
        npi: String(fixture.raw?.npi),
        name: request.expertName,
        credential: null,
        taxonomy: request.specialty,
        city: request.city,
        state: null,
        url: fixture.url ?? '',
      },
      basis: ['development fixture'],
      note: 'Development fixture. This is not a real NPI Registry record.',
      notes: [],
      candidates: [],
      simulated: true,
    };
  }
  if (registry) {
    return {
      status: 'unavailable',
      identity: null,
      basis: [],
      note:
        registry.message ??
        'The NPI Registry could not be checked. Identity was not confirmed.',
      notes: [],
      candidates: [],
    };
  }
  return null;
}

/** The uploaded CV as the "CV and profile" source result. */
async function readCvSource(
  request: EwiInvestigationRequest,
  dependencies: InvestigationWorkflowDependencies,
  notify?: (message: string) => Promise<void>,
): Promise<ExpertResearchSourceResult> {
  const retrievedAt = new Date().toISOString();
  try {
    const extraction = await dependencies.readCv!(
      request.cvDocumentId!,
      notify ?? (() => Promise.resolve()),
    );
    if (!extraction) {
      return {
        sourceId: 'cv_profile',
        status: 'unavailable',
        outcome: 'unavailable',
        access: 'public',
        message: 'The uploaded CV was not found. Nothing was read.',
        retrievedAt,
        items: [],
      };
    }
    const { document, claims } = extraction;
    const item: ExpertEvidenceItem = {
      sourceId: 'cv_profile',
      category: 'cv',
      title: `Expert CV: ${document.name}`,
      summary: `${claims.length} claim(s) read from the uploaded CV (${document.pageCount} page${document.pageCount === 1 ? '' : 's'}). Each claim keeps its page and an exact quote.`,
      simulated: false,
      access: 'public',
      informationStatus: 'unverified',
      identityMatch: 'matched',
      retrievedAt,
      source: {
        providerId: 'cv_profile',
        name: 'Uploaded CV',
        retrievedAt,
        access: 'public',
      },
      raw: {
        identity: { name: request.expertName, verifiedBy: 'source_match' },
        cvExtraction: extraction,
      },
    };
    return {
      sourceId: 'cv_profile',
      status: claims.length > 0 ? 'ok' : 'no_result',
      outcome: claims.length > 0 ? 'success' : 'no_result',
      access: 'public',
      message: [
        `Read ${claims.length} claim(s) from the uploaded CV.`,
        ...extraction.warnings,
      ].join(' '),
      retrievedAt,
      items: [item],
    };
  } catch (error) {
    return {
      sourceId: 'cv_profile',
      status: 'error',
      outcome: 'api_failure',
      access: 'public',
      message: `The uploaded CV could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      retrievedAt,
      items: [],
    };
  }
}

/** True when URL/title/summary/content indicate a CV or resume document. */
export function recordLooksLikeCvDocument(record: {
  url: string;
  title: string;
  summary: string;
}): boolean {
  const hay = `${record.url} ${record.title} ${record.summary}`.toLowerCase();
  if (/\.pdf($|\?)/i.test(record.url)) return true;
  if (/\b(curriculum vitae|\bcv\b|resume|résumé)\b/.test(hay)) return true;
  if (/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?)/i.test(record.url)) {
    return (
      /\b(curriculum vitae|\bcv\b|resume|résumé|education|licensure|publications)\b/.test(
        hay,
      ) || textLooksLikeCurriculumVitae(record.summary)
    );
  }
  return textLooksLikeCurriculumVitae(record.summary);
}

/** Public CV/resume URLs found for this expert (read or unread). */
export function publicCvCandidateUrls(
  dossier: WebResearchDossier,
  expertName?: string,
): string[] {
  const urls: string[] = [];
  for (const record of dossier.records) {
    if (record.match.level !== 'strong') continue;
    if (isOtherPersonCvRecord(record, expertName)) continue;
    if (!cvRecordNamesSubject(record, expertName)) continue;
    if (!recordLooksLikeCvDocument(record)) continue;
    urls.push(record.url);
  }
  return [...new Set(urls)].slice(0, 5);
}

/**
 * A public CV URL was found and the page was read, but no usable claims
 * could be extracted (distinct from discovery failure).
 */
export function publicCvFoundUnparsed(
  dossier: WebResearchDossier,
  expertName?: string,
): string[] {
  const urls: string[] = [];
  for (const record of dossier.records) {
    if (record.match.level !== 'strong') continue;
    if (record.read !== 'read') continue;
    if (isOtherPersonCvRecord(record, expertName)) continue;
    if (!cvRecordNamesSubject(record, expertName)) continue;
    if (!recordLooksLikeCvDocument(record)) continue;
    if ((record.summary ?? '').trim().length < 80) continue;
    urls.push(record.url);
  }
  return [...new Set(urls)].slice(0, 5);
}

/** Strong-match public CV/resume for this expert → synthetic CV extraction. */
export function extractionFromWebsiteCv(
  dossier: WebResearchDossier,
  expertName?: string,
): CvExtraction | null {
  const ranked = dossier.records
    .filter((entry) => isWebsiteCvRecord(entry, expertName))
    .map((entry) => ({
      entry,
      score: scoreWebsiteCvRecord(entry, expertName),
    }))
    .filter((row) => row.score >= 40)
    .sort((left, right) => right.score - left.score);
  const record = ranked[0]?.entry;
  if (!record) return null;
  const drafts: Array<Omit<CvClaim, 'id'>> = [];
  for (const claim of record.claims ?? []) {
    const category = cvCategoryForWebTopic(claim.topic);
    if (!category) continue;
    const details =
      category === 'publication'
        ? { title: publicationTitleFromText(claim.text || claim.quote) }
        : category === 'education'
          ? { institution: claim.text.slice(0, 120) }
          : {};
    drafts.push({
      category,
      statement: claim.text,
      details,
      page: 1,
      quote: claim.quote || claim.text,
    });
  }
  // Structured heuristics + bibliography when web claim extraction was thin.
  const body = `${record.title}\n${record.summary}`;
  if (drafts.length < 8 || textLooksLikeCurriculumVitae(body)) {
    for (const claim of extractStructuredClaimsFromCvText(body, 1)) {
      drafts.push(claim);
    }
  }
  const pubCount = drafts.filter((c) => c.category === 'publication').length;
  if (pubCount < 5) {
    for (const line of bibliographyLinesFromText(body)) {
      if (drafts.filter((c) => c.category === 'publication').length >= 40)
        break;
      const title = publicationTitleFromText(line);
      if (!title || title.length < 12) continue;
      if (
        drafts.some(
          (c) =>
            c.category === 'publication' &&
            (c.details.title ?? '').toLowerCase() === title.toLowerCase(),
        )
      ) {
        continue;
      }
      drafts.push({
        category: 'publication',
        statement: line.slice(0, 400),
        details: { title },
        page: 1,
        quote: line.slice(0, 280),
      });
    }
  }
  const finalized = finalizeCvClaims(drafts);
  if (finalized.length === 0) return null;
  const retrievedAt = record.retrievedAt ?? new Date().toISOString();
  return {
    document: {
      id: record.url,
      name: record.title || 'Public CV',
      pageCount: 1,
      unreadablePages: [],
      ocrPages: [],
    },
    status: 'completed',
    claims: finalized,
    warnings: [
      `CV was publicly located and read from ${record.url} (retrieved ${retrievedAt}), not from an uploaded file.`,
      `Extracted ${finalized.length} claim(s) for comparison.`,
    ],
  };
}

function bibliographyLinesFromText(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(
      (line) =>
        line.length >= 40 &&
        (/\b(19|20)\d{2}\b/.test(line) ||
          /\b(et al\.|journal|proceedings|doi:|pmid)\b/i.test(line)),
    )
    .slice(0, 40);
}

function publicationTitleFromText(text: string): string | undefined {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  // Prefer quoted or sentence-case title before journal/year tail.
  const quoted = cleaned.match(/[“"]([^”"]{12,180})[”"]/);
  if (quoted) return quoted[1].trim();
  const beforeYear = cleaned.split(/\b(?:19|20)\d{2}\b/)[0]?.trim();
  if (beforeYear && beforeYear.length >= 12 && beforeYear.length <= 220) {
    return beforeYear.replace(/[.,;:\s]+$/, '');
  }
  return cleaned.slice(0, 180);
}

function isWebsiteCvRecord(record: WebRecord, expertName?: string): boolean {
  if (record.match.level !== 'strong') return false;
  if (record.read !== 'read' && !(record.claims && record.claims.length > 0)) {
    return false;
  }
  if (
    record.kind !== 'expert_website' &&
    record.kind !== 'other' &&
    record.kind !== 'profile' &&
    record.kind !== 'advertising'
  ) {
    return false;
  }
  if (!recordLooksLikeCvDocument(record)) return false;
  if (isOtherPersonCvRecord(record, expertName)) return false;
  return cvRecordNamesSubject(record, expertName);
}

function scoreWebsiteCvRecord(record: WebRecord, expertName?: string): number {
  const parsed = parsePersonName(expertName ?? '');
  const surname = (parsed?.last ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const first = (parsed?.first ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const url = record.url.toLowerCase();
  const file = url.split('/').pop()?.split('?')[0] ?? '';
  const host = (() => {
    try {
      return new URL(record.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const hay = `${record.url} ${record.title} ${record.summary}`.toLowerCase();
  let score = 10;
  if (surname && host.replace(/[^a-z]/g, '').includes(surname)) score += 50;
  if (surname && file.replace(/[^a-z]/g, '').includes(surname)) score += 40;
  if (first && file.replace(/[^a-z]/g, '').includes(first)) score += 15;
  if (/\bcurriculum vitae\b/.test(hay)) score += 20;
  if (/\.pdf($|\?)/i.test(record.url)) score += 10;
  if (/drive\.google\.com/i.test(record.url)) score += 15;
  if (textLooksLikeCurriculumVitae(record.summary)) score += 25;
  if ((record.claims?.length ?? 0) >= 5) score += 10;
  if (record.kind === 'expert_website') score += 10;
  return score;
}

/** True when the CV page/file is clearly someone else’s curriculum vitae. */
function isOtherPersonCvRecord(
  record: WebRecord,
  expertName?: string,
): boolean {
  const parsed = parsePersonName(expertName ?? '');
  if (!parsed) return false;
  const surname = parsed.last.toLowerCase().replace(/[^a-z]/g, '');
  const first = parsed.first.toLowerCase().replace(/[^a-z]/g, '');
  const url = record.url.toLowerCase();
  const file = (url.split('/').pop()?.split('?')[0] ?? '').replace(
    /[^a-z]/g,
    '',
  );
  let hostLetters = '';
  try {
    hostLetters = new URL(record.url).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/[^a-z]/g, '');
  } catch {
    /* ignore */
  }
  const onOwnHost = Boolean(surname && hostLetters.includes(surname));
  const title = record.title.toLowerCase();
  const summaryHead = record.summary.slice(0, 400).toLowerCase();
  // Filename like Jesse+Fischer+CV.pdf — reject unless this is the expert’s
  // own host (where a generic cv.pdf can still be theirs).
  if (
    file.includes('cv') ||
    file.includes('resume') ||
    file.includes('vitae')
  ) {
    if (surname && !file.includes(surname) && !onOwnHost) return true;
  }
  if (/\b(curriculum vitae|resume)\b/.test(title)) {
    if (surname && !title.includes(parsed.last.toLowerCase()) && !onOwnHost) {
      return true;
    }
  }
  // Opening lines name another person as the CV subject (summary is lowercased).
  const otherLead =
    summaryHead.match(
      /\b(?:curriculum vitae|resume)\b[\s\S]{0,80}?\b([a-z]+(?:\s+[a-z]+){1,3})\b/,
    ) ??
    summaryHead.match(
      /^([a-z]+(?:\s+[a-z]+){1,3}),?\s*(?:ph\.?d\.?|psy\.?d\.?|m\.?d\.?)/,
    );
  if (otherLead) {
    const named = otherLead[1].replace(/[^a-z\s]/g, '');
    if (
      !named.includes(surname) &&
      !(first && named.includes(first) && named.includes(surname))
    ) {
      return true;
    }
  }
  return false;
}

function cvRecordNamesSubject(record: WebRecord, expertName?: string): boolean {
  const parsed = parsePersonName(expertName ?? '');
  if (!parsed) return true;
  const surname = parsed.last.toLowerCase();
  const hay = [
    record.url,
    record.title,
    record.summary,
    ...(record.claims ?? []).flatMap((claim) => [claim.text, claim.quote]),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(surname);
}

function cvCategoryForWebTopic(
  topic: string | undefined,
): CvClaimCategory | null {
  if (!topic) return null;
  if ((CV_CLAIM_CATEGORIES as readonly string[]).includes(topic)) {
    return topic as CvClaimCategory;
  }
  const map: Record<string, CvClaimCategory> = {
    board_certification: 'board_certification',
    license: 'license',
    education: 'education',
    membership: 'membership',
    publication: 'publication',
    award: 'award',
    employment: 'appointment',
    advertising: 'expert_witness',
    ime: 'expert_witness',
  };
  return map[topic] ?? null;
}

/** Compares the CV's claims with the collected sources, or null without a CV. */
async function buildCvCheck(
  request: EwiInvestigationRequest,
  evidence: ExpertEvidenceItem[],
  sourceResults: ExpertResearchSourceResult[],
  dependencies: InvestigationWorkflowDependencies,
): Promise<CvCheck | null> {
  const item = evidence.find(
    (candidate) =>
      candidate.sourceId === 'cv_profile' && candidate.raw?.cvExtraction,
  );
  if (!item) return null;
  const extraction = item.raw!.cvExtraction as CvExtraction;
  const citations: PublicationQuery[] = extraction.claims
    .filter((claim) => claim.category === 'publication' && claim.details.title)
    .map((claim) => ({
      title: claim.details.title!,
      citation: claim.statement,
      journal: claim.details.journal,
      year: parseYear(claim.details.year) ?? parseYear(claim.statement),
      doi: claim.details.doi,
      pmid: claim.details.pmid,
      type: claim.details.publicationType as PublicationQuery['type'],
    }));
  let publications: PublicationLookupResult[] = [];
  if (citations.length > 0 && dependencies.research.lookupPublications) {
    try {
      publications = await dependencies.research.lookupPublications(
        request.expertName,
        citations,
      );
    } catch (error) {
      dependencies.logger?.warn(
        `CV publication lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
  return compareCv({
    extraction,
    evidence,
    sourceResults,
    identity: identityFromResearch(request, sourceResults, evidence),
    publications,
    expertName: request.expertName,
  });
}

function verificationAttempts(
  results: ExpertResearchSourceResult[],
): VerificationAttempt[] {
  return results.map((result) => ({
    providerId: result.sourceId,
    status: result.status,
    outcome: result.outcome,
    access: result.access,
    itemCount: result.items.length,
  }));
}

function failedResult(
  sourceId: ExpertResearchProviderId,
  message: string,
): ExpertResearchSourceResult {
  return {
    sourceId,
    status: 'error',
    outcome: 'api_failure',
    access: sourceId === 'lexisnexis' ? 'restricted' : 'unavailable',
    message,
    retrievedAt: new Date().toISOString(),
    items: [],
  };
}

async function report(
  dependencies: InvestigationWorkflowDependencies,
  stage: InvestigationStageDefinition,
  progress: number,
  message: string,
): Promise<void> {
  await dependencies.onProgress?.({
    step: stage.id,
    stepLabel: stage.label,
    progress,
    message,
  });
}
