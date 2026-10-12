import type { ConfigService } from '@nestjs/config';
import type { WorkerOptions } from 'bullmq';
import type { JobsSettings } from '@config/config.types';

/**
 * Shared BullMQ worker settings for MCA and EWI. A long lock keeps a busy
 * job (OCR, slow AI calls) from being taken for stalled, and a stalled job
 * is failed instead of being run, and paid for, a second time.
 */
export function workerOptions(
  config: ConfigService,
): Pick<WorkerOptions, 'concurrency' | 'lockDuration' | 'maxStalledCount'> {
  const jobs = config.get<JobsSettings>('jobs');
  return {
    concurrency: jobs?.concurrency ?? 1,
    lockDuration: jobs?.lockDurationMs ?? 600_000,
    maxStalledCount: 0,
  };
}
