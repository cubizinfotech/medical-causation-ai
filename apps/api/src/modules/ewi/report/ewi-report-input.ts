import {
  researchCoverageFor,
  type ResearchCoverage,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiInvestigationResult } from '../investigation/jobs/ewi-investigation-job.types';
import type { CvCheck, CvComparison } from '../cv/cv.types';
import { isCatalogAbsenceFinding } from '../cv/cv-comparison';
import {
  buildLegalResearchDossier,
  type LegalResearchDossier,
} from '../research/legal';
import {
  buildQuestionDrafts,
  draftFromStoredQuestion,
  finalizeQuestions,
  QUESTION_TARGET,
  questionIsGrounded,
} from './ewi-report-questions';
import type { EwiReportInput } from './ewi-pdf-report.service';
import type { ReportSourceStatus } from './ewi-report.template';

const STALE_QUESTION =
  /\b(finding f\d+|collected record|investigation file|how should counsel weigh|collected status|finding ?key)\b/i;

/**
 * Report input from a stored investigation. Older runs keep their stored
 * evidence; questions and coverage wording are corrected for the current
 * template without writing back to the database.
 */
export function prepareEwiReportInput(
  result: EwiInvestigationResult,
): EwiReportInput {
  const cvCheck = presentCvCheck(result.cvCheck ?? null);
  const discrepancies = discrepanciesForReport(result);
  const preparedQuestions = questionsForReport(result, discrepancies);
  return {
    expertName: result.expertName,
    city: result.city,
    specialty: result.specialty,
    evidence: result.evidence ?? [],
    discrepancies,
    questions: preparedQuestions.questions,
    generatedAt: result.generatedAt,
    summary: result.summary,
    analysis: result.analysis?.document,
    legalResearch: legalResearchForReport(result),
    onlinePresence: result.onlinePresence,
    professionalBackground: result.professionalBackground,
    identity: result.identity ?? null,
    cvCheck,
    additionalContext: result.additionalContext ?? null,
    webResearch: result.webResearch ?? null,
    sourceStatuses: sourceStatusesForReport(result),
    questionsNote: preparedQuestions.note,
  };
}

export function questionsAreStale(
  questions: CrossExamQuestion[] | undefined,
): boolean {
  if (!questions || questions.length === 0) return false;
  return questions.some(
    (question) =>
      STALE_QUESTION.test(question.question) || !questionIsGrounded(question),
  );
}

function presentCvCheck(check: CvCheck | null): CvCheck | null {
  if (!check) return null;
  return {
    ...check,
    comparisons: check.comparisons.map(presentComparison),
  };
}

function presentComparison(row: CvComparison): CvComparison {
  if (row.topic !== 'publication' || row.label !== 'not_found') return row;
  return {
    ...row,
    label: 'not_verified',
    severity: 'low',
    title: row.title.replace(
      /Publication not found in the catalogs checked:/i,
      'Publication not confirmed in the catalogs searched:',
    ),
    note: [
      row.note,
      'Absence from OpenAlex or another catalog is not proof the citation is false.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function discrepanciesForReport(
  result: EwiInvestigationResult,
): ExpertDiscrepancy[] {
  return (result.discrepancies ?? []).filter(
    (row) => !isCatalogAbsenceFinding(row),
  );
}

/**
 * Rebuilds the legal dossier from stored evidence so docket URL slugs can
 * supply captions that were unresolved when the investigation finished.
 * Source-attempt rows stay as recorded. Findings rows are not written.
 */
function legalResearchForReport(
  result: EwiInvestigationResult,
): LegalResearchDossier | undefined {
  const stored = result.legalResearch;
  const evidence = result.evidence ?? [];
  if (evidence.length === 0) return stored;
  const rebuilt = buildLegalResearchDossier({ evidence });
  if (stored?.sourceAttempts?.length) {
    return { ...rebuilt, sourceAttempts: stored.sourceAttempts };
  }
  return rebuilt;
}

function questionsForReport(
  result: EwiInvestigationResult,
  discrepancies: ExpertDiscrepancy[],
): { questions: CrossExamQuestion[]; note?: string } {
  const stored = result.questions ?? [];
  const generatedInput = {
    expertName: result.expertName,
    evidence: result.evidence ?? [],
    discrepancies,
    cvCheck: result.cvCheck,
    sourceStatuses: result.sourceStatuses,
  };
  const storedDrafts = stored
    .filter(
      (question) =>
        questionIsGrounded(question) && !STALE_QUESTION.test(question.question),
    )
    .map(draftFromStoredQuestion);
  const generatedDrafts = buildQuestionDrafts(generatedInput);
  const legalDrafts = generatedDrafts.filter(
    (draft) => draft.theme === 'Prior testimony and legal matters',
  );

  if (stored.length === 0) {
    const questions = finalizeQuestions(generatedDrafts);
    if (questions.length === 0) return { questions: [] };
    return {
      questions,
      note: [
        'These questions were generated from the current collected evidence. Stored investigation records were not changed.',
        questionShortfallNote(questions.length, result),
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  if (storedDrafts.length === 0) {
    const questions = finalizeQuestions(generatedDrafts);
    return {
      questions,
      note: [
        'These questions were generated from the current collected evidence. Earlier template-generated questions from a previous report version are not reprinted.',
        questionShortfallNote(questions.length, result),
      ].join(' '),
    };
  }

  const fromStoredOnly = finalizeQuestions(storedDrafts);
  const questions = finalizeQuestions([...storedDrafts, ...legalDrafts]);
  const omitted = storedDrafts.length < stored.length;
  const addedLegal = questions.length > fromStoredOnly.length;
  const parts: string[] = [];
  if (omitted) {
    parts.push(
      'Questions that could not be tied to collected evidence were omitted from this report.',
    );
  }
  if (addedLegal) {
    parts.push(
      'Legal questions were generated from collected filings using the current captions.',
    );
  }
  if (parts.length > 0) {
    parts.push('Stored investigation records were not changed.');
  }
  parts.push(questionShortfallNote(questions.length, result));
  return { questions, note: parts.filter(Boolean).join(' ') };
}

export interface QuestionShortfallContext {
  cvCheck?: EwiInvestigationResult['cvCheck'] | null;
  sourceStatuses?: Array<{
    sourceId: string;
    coverage?: string | null;
    outcome?: string | null;
  }>;
  evidence?: Array<{ sourceId: string; category: string }>;
}

export function questionShortfallNote(
  count: number,
  result?: QuestionShortfallContext,
): string {
  if (count >= QUESTION_TARGET) {
    return `${count} evidence-based questions were generated (target ${QUESTION_TARGET}). None were padded.`;
  }
  const needed = missingEvidenceForMoreQuestions(result);
  return `${count} evidence-based question(s) were generated. The target is ${QUESTION_TARGET} when there are enough distinct collected facts. This report has fewer because only ${count} distinct sourced fact(s), discrepancy(ies), or coverage gap(s) were available. Facts were not invented to reach ${QUESTION_TARGET}.${needed}`;
}

/** What additional permitted evidence would be needed to write more questions. */
export function missingEvidenceForMoreQuestions(
  result?: QuestionShortfallContext,
): string {
  if (!result) return '';
  const missing: string[] = [];
  if (!result.cvCheck) {
    missing.push('an uploaded curriculum vitae');
  }
  const evidence = result.evidence ?? [];
  const foundSource = (id: string) =>
    evidence.some((item) => item.sourceId === id);
  const statuses = result.sourceStatuses ?? [];
  const coverageOf = (id: string) =>
    statuses.find((status) => status.sourceId === id)?.coverage ??
    statuses.find((status) => status.sourceId === id)?.outcome ??
    '';
  const unresolved = (id: string) => {
    const coverage = coverageOf(id);
    return (
      coverage === 'not_implemented' ||
      coverage === 'not_configured' ||
      coverage === 'blocked_or_access_denied' ||
      coverage === 'failed' ||
      coverage === 'unavailable'
    );
  };
  if (unresolved('board_certification')) {
    missing.push('an official board-certification directory entry');
  }
  if (unresolved('state_license')) {
    missing.push('official state license-board pages that can be read');
  }
  if (unresolved('social')) {
    missing.push('public social-media profiles that open without a login');
  }
  if (!foundSource('youtube') && !evidence.some((item) => item.category === 'video')) {
    missing.push(
      'public videos or a direct audio/video file that can be transcribed',
    );
  }
  if (
    !foundSource('courtlistener') &&
    !foundSource('justia') &&
    !evidence.some(
      (item) => item.category === 'legal' || item.category === 'court_order',
    )
  ) {
    missing.push('additional public court filings with readable text');
  }
  if (unresolved('depositions')) {
    missing.push('a user-supplied deposition transcript (depositions are not scraped)');
  }
  if (unresolved('patents')) {
    missing.push('public patent or trademark records after USPTO identity verification');
  }
  if (unresolved('university_accreditation')) {
    missing.push('CHEA or U.S. Department of Education accreditation confirmation');
  }
  if (missing.length === 0) return '';
  return ` More questions would need: ${missing.slice(0, 8).join('; ')}.`;
}

function sourceStatusesForReport(
  result: EwiInvestigationResult,
): ReportSourceStatus[] {
  return (result.sourceStatuses ?? []).map((status) => {
    const coverage: ResearchCoverage = researchCoverageFor({
      status: status.status,
      outcome: status.outcome,
      message: status.message,
      itemCount: status.itemCount,
      skipped: status.attemptStatus === 'skipped',
    });
    const checked =
      coverage === 'searched_with_results' ||
      coverage === 'searched_no_results' ||
      coverage === 'failed' ||
      coverage === 'blocked_or_access_denied';
    return {
      sourceId: status.sourceId,
      status: status.status,
      outcome: status.outcome,
      coverage,
      message: status.message,
      itemCount: status.itemCount,
      checked,
      retrievedAt: status.retrievedAt,
    };
  });
}
