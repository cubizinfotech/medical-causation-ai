export const MEDICAL_ANALYSIS_QUEUE_NAME = 'medical-analysis';

export const ANALYSIS_JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AnalysisJobStatus =
  (typeof ANALYSIS_JOB_STATUS)[keyof typeof ANALYSIS_JOB_STATUS];

export const ANALYSIS_JOB_STEPS = {
  INTAKE: 'intake',
  PRIVATE_KB: 'private-kb',
  PUBLIC_LIT: 'public-lit',
  EVIDENCE: 'evidence',
  REASONING: 'reasoning',
  SUMMARY: 'summary',
  CROSS_EXAM: 'cross-exam',
  REPORT: 'report',
} as const;

export type AnalysisJobStep =
  (typeof ANALYSIS_JOB_STEPS)[keyof typeof ANALYSIS_JOB_STEPS];

export const ANALYSIS_JOB_STEP_LABELS: Record<AnalysisJobStep, string> = {
  [ANALYSIS_JOB_STEPS.INTAKE]: 'Medical Case Intake',
  [ANALYSIS_JOB_STEPS.PRIVATE_KB]: 'Searching Private Knowledge Base',
  [ANALYSIS_JOB_STEPS.PUBLIC_LIT]: 'Searching Public Medical Literature',
  [ANALYSIS_JOB_STEPS.EVIDENCE]: 'Evidence Analysis',
  [ANALYSIS_JOB_STEPS.REASONING]: 'Medical Reasoning',
  [ANALYSIS_JOB_STEPS.SUMMARY]: 'Generating Statistical Summary',
  [ANALYSIS_JOB_STEPS.CROSS_EXAM]: 'Generating Cross Examination Questions',
  [ANALYSIS_JOB_STEPS.REPORT]: 'Final Report',
};
