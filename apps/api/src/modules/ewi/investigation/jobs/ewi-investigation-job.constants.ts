export const EWI_INVESTIGATION_QUEUE_NAME = 'ewi-investigation';

export const EWI_JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type EwiJobStatus = (typeof EWI_JOB_STATUS)[keyof typeof EWI_JOB_STATUS];

export const EWI_JOB_STEPS = {
  INTAKE: 'intake',
  PROFILE: 'profile',
  CREDENTIALS: 'credentials',
  SCHOLARSHIP: 'scholarship',
  LEGAL: 'legal',
  PUBLIC_WEB: 'public-web',
  DISCREPANCY: 'discrepancy',
  QUESTIONS: 'questions',
  REPORT: 'report',
} as const;

export type EwiJobStep = (typeof EWI_JOB_STEPS)[keyof typeof EWI_JOB_STEPS];

export const EWI_JOB_STEP_LABELS: Record<EwiJobStep, string> = {
  [EWI_JOB_STEPS.INTAKE]: 'Expert Intake',
  [EWI_JOB_STEPS.PROFILE]: 'Identity & Profile Discovery',
  [EWI_JOB_STEPS.CREDENTIALS]: 'Credentials & Licenses',
  [EWI_JOB_STEPS.SCHOLARSHIP]: 'Publications, Grants & Patents',
  [EWI_JOB_STEPS.LEGAL]: 'Legal Cases & Directories',
  [EWI_JOB_STEPS.PUBLIC_WEB]: 'News, Web & Media',
  [EWI_JOB_STEPS.DISCREPANCY]: 'Discrepancy Analysis',
  [EWI_JOB_STEPS.QUESTIONS]: 'Cross-Examination Questions',
  [EWI_JOB_STEPS.REPORT]: 'Word Report Assembly',
};
