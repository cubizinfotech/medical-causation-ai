import { MedicalAnalysisProcessor } from './medical-analysis.processor';
import type { MedicalAnalysisJobPayload } from './medical-analysis-job.types';

const request = {
  medicalQuestion: 'Did the collision materially cause the cervical strain?',
  patientInformation: 'Age: 47, Gender: male',
  injury: 'Motor Vehicle Collision: Rear-end collision.',
  diagnosis: 'Cervical strain',
  symptoms: 'Neck pain',
  accidentDate: '2023-09-14',
};

describe('MedicalAnalysisProcessor', () => {
  function createProcessor(analyze: jest.Mock) {
    const jobService = {
      markRunning: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      reportProgress: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new MedicalAnalysisProcessor(
      {} as never,
      jobService as never,
      { analyze } as never,
    );
    return { processor, jobService };
  }

  it('marks the job completed when analysis succeeds', async () => {
    const result = { executiveSummary: 'Done' };
    const { processor, jobService } = createProcessor(
      jest.fn().mockResolvedValue(result),
    );

    await (
      processor as unknown as {
        process: (payload: MedicalAnalysisJobPayload) => Promise<void>;
      }
    ).process({ jobId: 'job-1', request });

    expect(jobService.markRunning).toHaveBeenCalledWith('job-1');
    expect(jobService.markCompleted).toHaveBeenCalledWith('job-1', result);
    expect(jobService.markFailed).not.toHaveBeenCalled();
  });

  it('records the failure and rethrows so the error is not swallowed', async () => {
    const { processor, jobService } = createProcessor(
      jest.fn().mockRejectedValue(new Error('knowledge base unavailable')),
    );

    await expect(
      (
        processor as unknown as {
          process: (payload: MedicalAnalysisJobPayload) => Promise<void>;
        }
      ).process({ jobId: 'job-2', request }),
    ).rejects.toThrow('knowledge base unavailable');

    expect(jobService.markFailed).toHaveBeenCalledWith(
      'job-2',
      'knowledge base unavailable',
    );
    expect(jobService.markCompleted).not.toHaveBeenCalled();
  });
});
