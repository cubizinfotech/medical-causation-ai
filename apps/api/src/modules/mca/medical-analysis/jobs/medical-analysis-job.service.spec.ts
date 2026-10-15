jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'queued' }),
    close: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
  })),
}));

import { Queue } from 'bullmq';
import { MedicalAnalysisJobService } from './medical-analysis-job.service';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';

const validDto: AnalyzeMedicalCaseDto = {
  patientAge: '47',
  patientGender: 'male',
  accidentDate: '2023-09-14',
  accidentType: 'Motor Vehicle Collision',
  accidentDescription: 'Rear-end collision with immediate neck pain.',
  diagnosis: 'Cervical strain',
  symptoms: 'Neck pain and headache',
  medicalQuestion: 'Did the collision materially cause the cervical strain?',
};

function createHarness(options: { jobsToday?: number } = {}) {
  const store = new Map<string, string>();
  const redis = {
    getConnectionOptions: () => ({ host: '127.0.0.1', port: 6379, db: 0 }),
    getJson: (key: string) =>
      Promise.resolve(store.has(key) ? JSON.parse(store.get(key)!) : null),
    setJson: (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
      return Promise.resolve();
    },
    updateJson: (key: string, mutate: (current: unknown) => unknown) => {
      if (!store.has(key)) return Promise.resolve(null);
      const next = mutate(JSON.parse(store.get(key)!));
      store.set(key, JSON.stringify(next));
      return Promise.resolve(next);
    },
    getClient: () => ({
      del: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
    }),
  };
  const history = {
    createCase: jest.fn().mockResolvedValue({ id: 'case-1' }),
    discardCase: jest.fn().mockResolvedValue(undefined),
    syncFromJobRecord: jest.fn().mockResolvedValue(undefined),
  };
  const caseRecords = {
    assertAttachable: jest.fn().mockResolvedValue(undefined),
    attachToCase: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    analysisCase: {
      count: jest.fn().mockResolvedValue(options.jobsToday ?? 0),
    },
    investigation: { count: jest.fn().mockResolvedValue(0) },
  };
  const config = { get: () => ({ dailyLimitPerUser: 5 }) };
  const service = new MedicalAnalysisJobService(
    redis as never,
    history as never,
    caseRecords as never,
    prisma as never,
    config as never,
  );
  service.onModuleInit();
  const queue = (Queue as unknown as jest.Mock).mock.results.at(-1)?.value as {
    add: jest.Mock;
  };
  return { service, store, history, caseRecords, queue };
}

describe('MedicalAnalysisJobService', () => {
  it('creates a case, stores a queued job, and dispatches the worker', async () => {
    const { service, store, history, queue } = createHarness();

    const created = await service.enqueue(validDto, 'user-1');

    expect(created.caseId).toBe('case-1');
    expect(created.status).toBe('queued');
    expect(history.createCase).toHaveBeenCalledWith(
      created.jobId,
      validDto,
      'user-1',
    );
    expect(queue.add).toHaveBeenCalledTimes(1);
    const dispatched = queue.add.mock.calls[0] as unknown as [
      string,
      {
        jobId: string;
        caseId: string;
        request: {
          medicalQuestion: string;
          patientInformation: string;
        };
      },
      { jobId: string },
    ];
    expect(dispatched[0]).toBe('run');
    expect(dispatched[1].jobId).toBe(created.jobId);
    expect(dispatched[1].caseId).toBe('case-1');
    expect(dispatched[1].request.medicalQuestion).toBe(
      validDto.medicalQuestion,
    );
    expect(dispatched[1].request.patientInformation).toBe(
      'Age: 47, Gender: male',
    );
    expect(dispatched[1].request).not.toHaveProperty('patientName');
    expect(JSON.stringify(dispatched[1].request)).not.toMatch(/patient name/i);
    expect(dispatched[2].jobId).toBe(created.jobId);

    const saved = JSON.parse(
      store.get(`analysis:job:${created.jobId}`) ?? '{}',
    ) as {
      status: string;
    };
    expect(saved.status).toBe('queued');
  });

  it('marks the job failed when the queue rejects the dispatch', async () => {
    const { service, store, queue } = createHarness();
    queue.add.mockRejectedValueOnce(new Error('Redis connection refused'));

    await expect(service.enqueue(validDto, 'user-1')).rejects.toThrow(
      'Redis connection refused',
    );

    const saved = [...store.values()].map(
      (value) => JSON.parse(value) as { status: string; error?: string },
    );
    // The user sees a plain message; the queue error stays in the log.
    expect(saved).toEqual([
      expect.objectContaining({
        status: 'failed',
        error:
          'The analysis could not be started. Please try again in a moment.',
      }),
    ]);
  });

  it('refuses a new analysis once the daily limit is reached', async () => {
    const { service, history } = createHarness({ jobsToday: 5 });
    await expect(service.enqueue(validDto, 'user-1')).rejects.toThrow(
      /limit of 5/,
    );
    expect(history.createCase).not.toHaveBeenCalled();
  });

  it('removes the new case when its records were taken by another analysis', async () => {
    const { service, history, caseRecords, queue } = createHarness();
    caseRecords.attachToCase.mockRejectedValueOnce(
      new Error('already belong to another analysis'),
    );
    await expect(
      service.enqueue(
        { ...validDto, recordIds: ['00000000-0000-4000-8000-000000000001'] },
        'user-1',
      ),
    ).rejects.toThrow(/another analysis/);
    expect(history.discardCase).toHaveBeenCalledWith('case-1');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('moves a job from queued to running to completed', async () => {
    const { service } = createHarness();
    const created = await service.enqueue(validDto, 'user-1');

    await service.markRunning(created.jobId);
    await expect(service.getJob(created.jobId)).resolves.toEqual(
      expect.objectContaining({ status: 'running' }),
    );

    await service.markCompleted(created.jobId, {
      executiveSummary: 'Summary',
    } as never);
    await expect(service.getJob(created.jobId)).resolves.toEqual(
      expect.objectContaining({ status: 'completed', progress: 100 }),
    );
  });

  it('records a failed analysis without dropping the job', async () => {
    const { service } = createHarness();
    const created = await service.enqueue(validDto, 'user-1');

    await service.markFailed(created.jobId, 'The model returned invalid JSON');

    await expect(service.getJob(created.jobId)).resolves.toEqual(
      expect.objectContaining({
        status: 'failed',
        error: 'The model returned invalid JSON',
      }),
    );
  });
});
