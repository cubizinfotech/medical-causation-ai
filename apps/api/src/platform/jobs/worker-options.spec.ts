import type { ConfigService } from '@nestjs/config';
import {
  EWI_LOCK_MS,
  workerConnection,
  workerOptions,
  ewiWorkerOptions,
} from './worker-options';

function configWith(jobs: {
  concurrency?: number;
  lockDurationMs?: number;
  maxStalledCount?: number;
}): ConfigService {
  return {
    get: (key: string) => (key === 'jobs' ? jobs : undefined),
  } as unknown as ConfigService;
}

describe('workerOptions', () => {
  it('uses a 30-minute lock and one stall recovery when jobs config is missing', () => {
    const options = workerOptions({
      get: () => undefined,
    } as unknown as ConfigService);
    expect(options.lockDuration).toBe(1_800_000);
    expect(options.maxStalledCount).toBe(1);
    expect(options.stalledInterval).toBe(30_000);
    expect(options.concurrency).toBe(1);
  });

  it('passes through JOB_LOCK_MS and JOB_MAX_STALLED_COUNT', () => {
    const options = workerOptions(
      configWith({
        concurrency: 2,
        lockDurationMs: 3_600_000,
        maxStalledCount: 0,
      }),
    );
    expect(options.concurrency).toBe(2);
    expect(options.lockDuration).toBe(3_600_000);
    expect(options.maxStalledCount).toBe(0);
  });

  it('caps the EWI lock so a dead worker recovers in two minutes', () => {
    const options = ewiWorkerOptions(
      configWith({
        lockDurationMs: 1_800_000,
      }),
    );
    expect(options.lockDuration).toBe(EWI_LOCK_MS);
    expect(options.stalledInterval).toBe(15_000);
  });
});

describe('workerConnection', () => {
  it('sets maxRetriesPerRequest to null for BullMQ', () => {
    expect(workerConnection({ host: '127.0.0.1', port: 6379, db: 0 })).toEqual({
      host: '127.0.0.1',
      port: 6379,
      db: 0,
      maxRetriesPerRequest: null,
    });
  });
});
