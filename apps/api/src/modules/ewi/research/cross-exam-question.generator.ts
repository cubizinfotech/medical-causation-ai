import { Injectable } from '@nestjs/common';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import { buildGroundedCrossExamQuestions } from '../report/ewi-report-questions';
import type { ExpertDiscrepancy } from './discrepancy-analyzer';

/**
 * verified: the fact is supported by a cited source quote tied to the expert.
 * allegation: a third party's claim (news, complaint, review). Reported, not adjudicated.
 * unresolved: identity not confirmed, sources conflict, or a record is unconfirmed.
 */
export type QuestionLabel = 'verified' | 'allegation' | 'unresolved';

/** Why the question is in the report. Absence of a search hit is not misconduct. */
export type QuestionBasisKind =
  'sourced_fact' | 'inconsistency' | 'limitation' | 'evidence_gap';

export interface QuestionSource {
  name: string;
  url?: string;
  /** Publication date when the source states one (ISO date). */
  date?: string;
}

export interface CrossExamQuestion {
  number: number;
  /** Theme heading the question is grouped under in the report. */
  category: string;
  question: string;
  evidenceBasis: string;
  label?: QuestionLabel;
  sources?: QuestionSource[];
  /** Evidence or discrepancy identifiers that motivated the question. */
  evidenceIds?: string[];
  basisKind?: QuestionBasisKind;
  relevance?: string;
  excerpt?: string;
}

/**
 * Cross-examination questions for the EWI report.
 * Each question cites a specific collected fact and source. Nothing is padded
 * to reach a count: no evidence means no questions.
 */
@Injectable()
export class CrossExamQuestionGenerator {
  generate(params: {
    expertName: string;
    specialty: string;
    evidence: ExpertEvidenceItem[];
    discrepancies: ExpertDiscrepancy[];
    cvCheck?: Parameters<typeof buildGroundedCrossExamQuestions>[0]['cvCheck'];
    sourceStatuses?: Parameters<
      typeof buildGroundedCrossExamQuestions
    >[0]['sourceStatuses'];
  }): CrossExamQuestion[] {
    return buildGroundedCrossExamQuestions(params);
  }
}
