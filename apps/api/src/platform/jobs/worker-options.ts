import type { ConfigService } from '@nestjs/config';
import type { WorkerOptions } from 'bullmq';
import type { JobsSettings } from '@config/config.types';

const DEFAULT_LOCK_MS = 1_800_000;

/**
 * Shared BullMQ worker settings for MCA and EWI. A long lock keeps a busy
 * job (OCR, slow AI calls) from being taken for stalled. One stall may be
 * recovered (EWI resumes from a checkpoint); a second stall fails the job
 * instead of running, and billing, it again.
 */
export function workerOptions(
  config: ConfigService,
): Pick<
  WorkerOptions,
  'concurrency' | 'lockDuration' | 'maxStalledCount' | 'stalledInterval'
> {
  const jobs = config.get<JobsSettings>('jobs');
  const lockDuration = jobs?.lockDurationMs ?? DEFAULT_LOCK_MS;
  return {
    concurrency: jobs?.concurrency ?? 1,
    lockDuration,
    stalledInterval: 30_000,
    maxStalledCount: jobs?.maxStalledCount ?? 1,
  };
}

/** BullMQ requires maxRetriesPerRequest=null on its own Redis connection. */
export function workerConnection(redis: {
  host: string;
  port: number;
  password?: string;
  db: number;
}): {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: null;
} {
  return { ...redis, maxRetriesPerRequest: null };
}
