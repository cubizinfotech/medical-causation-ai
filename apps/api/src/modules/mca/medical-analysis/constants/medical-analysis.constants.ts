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
} as const;

export const CONFIDENCE_DISCLAIMER =
  'This confidence score reflects the strength of retrieved evidence alignment, not a medical diagnosis or legal determination.';
