import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  analyzeInconsistencies,
  type Inconsistency,
  type VerificationAttempt,
} from './inconsistency-analyzer';

export type ExpertDiscrepancy = Inconsistency;
export type { VerificationAttempt };

/**
 * Deterministic comparison of collected statements.
 * Model output is not an input.
 */
export class DiscrepancyAnalyzer {
  analyze(
    items: ExpertEvidenceItem[],
    attempts: readonly VerificationAttempt[] = [],
  ): ExpertDiscrepancy[] {
    return analyzeInconsistencies(items, attempts);
  }
}
