import type { JobsSettings } from './config.types';

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const jobsConfig = (): JobsSettings => ({
  stateTtlSeconds: positive(process.env.JOB_STATE_TTL_SECONDS, 14400),
  concurrency: Math.max(1, positive(process.env.JOB_CONCURRENCY, 1)),
  // OCR and long AI calls can keep the event loop busy. A short lock would
  // let BullMQ think the job stalled and run it a second time.
  lockDurationMs: Math.max(30_000, positive(process.env.JOB_LOCK_MS, 600_000)),
  dailyLimitPerUser: positive(process.env.JOB_DAILY_LIMIT_PER_USER, 50),
});
