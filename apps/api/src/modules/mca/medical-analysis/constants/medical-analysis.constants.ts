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
  EVIDENCE_EVALUATION: 'evidence-evaluation.prompt.txt',
  JSON_OUTPUT: 'json-output.prompt.txt',
  CHRONOLOGY_EXTRACTION: 'chronology-extraction.prompt.txt',
  BILLING_EXTRACTION: 'billing-extraction.prompt.txt',
  DEMAND_LETTER_TREATMENT: 'demand-letter-treatment.prompt.txt',
} as const;

export const CONFIDENCE_DISCLAIMER =
  'This confidence score reflects the strength of retrieved evidence alignment, not a medical diagnosis or legal determination.';
