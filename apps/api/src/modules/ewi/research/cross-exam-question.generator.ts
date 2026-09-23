import { Injectable } from '@nestjs/common';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import { buildGroundedCrossExamQuestions } from '../report/ewi-report-questions';
import type { ExpertDiscrepancy } from './discrepancy-analyzer';

export interface CrossExamQuestion {
  number: number;
  category: string;
  question: string;
  evidenceBasis: string;
}

/**
 * Cross-examination questions for the EWI report.
 * Questions cite collected findings. They are not padded when no finding exists.
 */
@Injectable()
export class CrossExamQuestionGenerator {
  generate(params: {
    expertName: string;
    specialty: string;
    evidence: ExpertEvidenceItem[];
    discrepancies: ExpertDiscrepancy[];
  }): CrossExamQuestion[] {
    return buildGroundedCrossExamQuestions(params);
  }
}
