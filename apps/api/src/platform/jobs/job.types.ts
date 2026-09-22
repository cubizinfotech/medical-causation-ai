export const QUEUE_PREFIXES = {
  MCA: '{mca-bull}',
  EWI: '{ewi-bull}',
} as const;

export const REDIS_KEY_PREFIXES = {
  MCA: 'mca:',
  EWI: 'ewi:',
} as const;

/** Shared async job status values used by MCA and EWI job services. */
export const COMMON_JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type CommonJobStatus =
  (typeof COMMON_JOB_STATUS)[keyof typeof COMMON_JOB_STATUS];

export interface CommonJobProgressUpdate {
  step: string;
  stepLabel: string;
  progress: number;
  message?: string;
}
