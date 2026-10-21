import type { JobsSettings } from './config.types';

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** 30 minutes. Live EWI + OCR/PDF can block the event loop longer than 10. */
const DEFAULT_LOCK_MS = 1_800_000;

export const jobsConfig = (): JobsSettings => ({
  stateTtlSeconds: positive(process.env.JOB_STATE_TTL_SECONDS, 14400),
  concurrency: Math.max(1, positive(process.env.JOB_CONCURRENCY, 1)),
  // OCR, PDF render, and long AI calls can delay lock renewal. A short lock
  // makes BullMQ fail the still-running job with "stalled more than allowable
  // limit". This is not a maximum runtime; the worker renews the lock.
  lockDurationMs: Math.max(
    30_000,
    positive(process.env.JOB_LOCK_MS, DEFAULT_LOCK_MS),
  ),
  maxStalledCount: Math.min(5, positive(process.env.JOB_MAX_STALLED_COUNT, 1)),
  dailyLimitPerUser: positive(process.env.JOB_DAILY_LIMIT_PER_USER, 50),
});
