export const EVIDENCE_CLASSIFICATIONS = {
  SUPPORTING: 'supporting',
  OPPOSING: 'opposing',
  NEUTRAL: 'neutral',
  UNKNOWN: 'unknown',
} as const;

export type EvidenceClassificationType =
  (typeof EVIDENCE_CLASSIFICATIONS)[keyof typeof EVIDENCE_CLASSIFICATIONS];

export const MEDICAL_ANALYSIS_PROMPTS = {
  SYSTEM: 'system.prompt.txt',
  MEDICAL_ANALYSIS: 'medical-analysis.prompt.txt',
  SUPPLEMENTED_SYSTEM: 'supplemented-system.prompt.txt',
  SUPPLEMENTED_ANALYSIS: 'supplemented-analysis.prompt.txt',
  LITERATURE_QUERIES: 'literature-queries.prompt.txt',
  EVIDENCE_EVALUATION: 'evidence-evaluation.prompt.txt',
  JSON_OUTPUT: 'json-output.prompt.txt',
  CHRONOLOGY_EXTRACTION: 'chronology-extraction.prompt.txt',
  BILLING_EXTRACTION: 'billing-extraction.prompt.txt',
  DEMAND_LETTER_TREATMENT: 'demand-letter-treatment.prompt.txt',
} as const;

export const CONFIDENCE_DISCLAIMER =
  'This confidence score reflects the strength of retrieved evidence alignment, not a medical diagnosis or legal determination.';

/**
 * Highest confidence an analysis may report when no cited source supports
 * it, matching the prompt rule "insufficient evidence: below 40".
 */
export const UNCITED_CONFIDENCE_CAP = 39;

/**
 * Output budget for the causation analysis JSON. A full answer with cited
 * evidence lists runs 3,000–6,000 tokens; a lower AI_MAX_TOKENS cut it off.
 */
export const ANALYSIS_MAX_OUTPUT_TOKENS = Number(
  process.env.MCA_ANALYSIS_MAX_TOKENS ?? 8192,
);
