jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'queued' }),
    close: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
  })),
}));

import { EwiInvestigationJobService } from './ewi-investigation-job.service';

function createHarness() {
  const store = new Map<string, unknown>();
  const redis = {
    getConnectionOptions: () => ({ host: '127.0.0.1', port: 6379, db: 0 }),
    getJson: (key: string) => Promise.resolve(store.get(key) ?? null),
    setJson: (key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    },
    updateJson: (key: string, mutate: (current: unknown) => unknown) => {
      if (!store.has(key)) return Promise.resolve(null);
      const next = mutate(store.get(key));
      store.set(key, next);
      return Promise.resolve(next);
    },
    getClient: () => ({
      del: (key: string) => Promise.resolve(store.delete(key)),
    }),
  };
  const history = {
    create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    updateFromJob: jest.fn().mockResolvedValue(undefined),
    cancelByJobId: jest.fn().mockResolvedValue(undefined),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    isCancelledByJobId: jest.fn().mockResolvedValue(false),
  };
  const prisma = {
    analysisCase: { count: jest.fn().mockResolvedValue(0) },
    investigation: { count: jest.fn().mockResolvedValue(0) },
  };
  const service = new EwiInvestigationJobService(
    redis as never,
    history as never,
    prisma as never,
    { get: () => ({ dailyLimitPerUser: 0 }) } as never,
  );
  service.onModuleInit();
  return { service, history, store };
}

const dto = { expertName: 'Jane Roe', city: 'Austin', specialty: 'Neurology' };

describe('EwiInvestigationJobService', () => {
  it('keeps a cancelled job cancelled when the worker reports late', async () => {
    const { service, history } = createHarness();
    const { jobId } = await service.enqueue(dto, 'user-1');

    await service.markRunning(jobId);
    await service.markCancelled(jobId);
    await service.reportProgress(jobId, {
      step: 'report',
      stepLabel: 'Report',
      progress: 90,
    });
    await service.markCompleted(jobId, {} as never, {
      fileName: 'r.pdf',
      mimeType: 'x',
      buffer: Buffer.from(''),
    });

    await expect(service.getJob(jobId)).resolves.toEqual(
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(history.markCompleted).not.toHaveBeenCalled();
  });

  it('still completes in the database when the Redis record expired', async () => {
    const { service, history, store } = createHarness();
    const { jobId } = await service.enqueue(dto, 'user-1');
    store.clear();

    await service.markCompleted(jobId, {} as never, {
      fileName: 'r.pdf',
      mimeType: 'x',
      buffer: Buffer.from(''),
    });
    expect(history.markCompleted).toHaveBeenCalled();
  });

  it('removes the progress record when the investigation is deleted', async () => {
    const { service } = createHarness();
    const { jobId } = await service.enqueue(dto, 'user-1');
    await service.deleteJobRecord(jobId);
    await expect(service.getJob(jobId)).rejects.toThrow(/not found/);
  });
});
