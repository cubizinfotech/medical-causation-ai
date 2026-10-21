import { jobsConfig } from './jobs.config';

const KEYS = [
  'JOB_STATE_TTL_SECONDS',
  'JOB_CONCURRENCY',
  'JOB_LOCK_MS',
  'JOB_MAX_STALLED_COUNT',
  'JOB_DAILY_LIMIT_PER_USER',
] as const;

describe('jobsConfig', () => {
  const original = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of KEYS) {
      original.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses a 30-minute lock and allows one stall recovery by default', () => {
    const jobs = jobsConfig();
    expect(jobs.lockDurationMs).toBe(1_800_000);
    expect(jobs.maxStalledCount).toBe(1);
    expect(jobs.concurrency).toBe(1);
  });

  it('reads JOB_LOCK_MS and JOB_MAX_STALLED_COUNT', () => {
    process.env.JOB_LOCK_MS = '3600000';
    process.env.JOB_MAX_STALLED_COUNT = '0';
    const jobs = jobsConfig();
    expect(jobs.lockDurationMs).toBe(3_600_000);
    expect(jobs.maxStalledCount).toBe(0);
  });

  it('does not allow a lock shorter than 30 seconds', () => {
    process.env.JOB_LOCK_MS = '1000';
    expect(jobsConfig().lockDurationMs).toBe(30_000);
  });
});
