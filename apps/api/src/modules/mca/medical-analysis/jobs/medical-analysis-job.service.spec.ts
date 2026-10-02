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

function createHarness() {
  const store = new Map<string, string>();
  const redis = {
    getConnectionOptions: () => ({ host: '127.0.0.1', port: 6379, db: 0 }),
    getTtlSeconds: () => 3600,
    getClient: () => ({
      set: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      del: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
    }),
  };
  const history = {
    createCase: jest.fn().mockResolvedValue({ id: 'case-1' }),
    syncFromJobRecord: jest.fn().mockResolvedValue(undefined),
  };
  const service = new MedicalAnalysisJobService(
    redis as never,
    history as never,
  );
  service.onModuleInit();
  const queue = (Queue as unknown as jest.Mock).mock.results.at(-1)?.value as {
    add: jest.Mock;
  };
  return { service, store, history, queue };
}

describe('MedicalAnalysisJobService', () => {
  it('creates a case, stores a queued job, and dispatches the worker', async () => {
    const { service, store, history, queue } = createHarness();

    const created = await service.enqueue(validDto);

    expect(created.caseId).toBe('case-1');
    expect(created.status).toBe('queued');
    expect(history.createCase).toHaveBeenCalledWith(created.jobId, validDto);
    expect(queue.add).toHaveBeenCalledTimes(1);
    const dispatched = queue.add.mock.calls[0] as unknown as [
      string,
      {
        jobId: string;
        request: {
          medicalQuestion: string;
          patientInformation: string;
        };
      },
      { jobId: string },
    ];
    expect(dispatched[0]).toBe('run');
    expect(dispatched[1].jobId).toBe(created.jobId);
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

    await expect(service.enqueue(validDto)).rejects.toThrow(
      'Redis connection refused',
    );

    const saved = [...store.values()].map(
      (value) => JSON.parse(value) as { status: string; error?: string },
    );
    expect(saved).toEqual([
      expect.objectContaining({
        status: 'failed',
        error: 'Redis connection refused',
      }),
    ]);
  });

  it('moves a job from queued to running to completed', async () => {
    const { service } = createHarness();
    const created = await service.enqueue(validDto);

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
    const created = await service.enqueue(validDto);

    await service.markFailed(created.jobId, 'The model returned invalid JSON');

    await expect(service.getJob(created.jobId)).resolves.toEqual(
      expect.objectContaining({
        status: 'failed',
        error: 'The model returned invalid JSON',
      }),
    );
  });
});
