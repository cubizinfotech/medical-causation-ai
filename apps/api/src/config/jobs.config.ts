import type { JobsSettings } from './config.types';
import { QUEUE_PREFIXES } from '@platform/jobs/job.types';

export const jobsConfig = (): JobsSettings => ({
  stateTtlSeconds: Number(
    process.env.JOB_STATE_TTL_SECONDS ??
      process.env.ANALYSIS_JOB_TTL_SECONDS ??
      14400,
  ),
  concurrency: Number(process.env.JOB_CONCURRENCY ?? 1),
  mcaQueuePrefix: process.env.MCA_QUEUE_PREFIX ?? QUEUE_PREFIXES.MCA,
  ewiQueuePrefix: process.env.EWI_QUEUE_PREFIX ?? QUEUE_PREFIXES.EWI,
});
