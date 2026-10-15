import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import {
  MedicalAnalysisProcessor,
  describeAnalysisFailure,
} from './medical-analysis.processor';
import type { MedicalAnalysisJobPayload } from './medical-analysis-job.types';
import { AnalysisSafetyException } from '../exceptions';
import { AnalysisResponseParseError } from '../utils';

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
      { get: () => undefined } as never,
    );
    return { processor, jobService };
  }

  it('marks the job completed when analysis succeeds', async () => {
    const result = { executiveSummary: 'Done' };
    const analyze = jest.fn().mockResolvedValue(result);
    const { processor, jobService } = createProcessor(analyze);

    await (
      processor as unknown as {
        process: (payload: MedicalAnalysisJobPayload) => Promise<void>;
      }
    ).process({ jobId: 'job-1', caseId: 'case-1', request });

    expect(jobService.markRunning).toHaveBeenCalledWith('job-1');
    expect(analyze).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ caseId: 'case-1' }),
    );
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
      ).process({ jobId: 'job-2', caseId: 'case-2', request }),
    ).rejects.toThrow('knowledge base unavailable');

    // The user sees a plain message, never the internal error text.
    expect(jobService.markFailed).toHaveBeenCalledWith(
      'job-2',
      expect.stringMatching(/did not complete\. Please try again/),
    );
    const [, saved] = jobService.markFailed.mock.calls[0] as [string, string];
    expect(saved).not.toContain('knowledge base unavailable');
    expect(jobService.markCompleted).not.toHaveBeenCalled();
  });
});

describe('describeAnalysisFailure', () => {
  it('explains AI provider problems without provider text', () => {
    const busy = describeAnalysisFailure(
      new RateLimitExceededException('gemini', 30000),
    );
    expect(busy.code).toBe('AI_BUSY');

    const quota = describeAnalysisFailure(
      new RateLimitExceededException('gemini', undefined, true),
    );
    expect(quota.code).toBe('AI_QUOTA_EXHAUSTED');

    const badKey = describeAnalysisFailure(
      new ProviderUnavailableException(
        'gemini',
        'API key not valid. key=AIzaSySecretValue1234567890123456789',
        'auth',
      ),
    );
    expect(badKey.code).toBe('AI_CONFIGURATION');
    expect(badKey.message).not.toMatch(/AIza|API key not valid/);

    expect(
      describeAnalysisFailure(
        new ProviderUnavailableException('gemini', 'timed out', 'timeout'),
      ).code,
    ).toBe('AI_TIMEOUT');
    expect(
      describeAnalysisFailure(new ProviderUnavailableException('gemini', '503'))
        .code,
    ).toBe('AI_UNAVAILABLE');
  });

  it('explains an answer that failed the citation checks', () => {
    expect(
      describeAnalysisFailure(new AnalysisSafetyException('unknown chunkId x'))
        .code,
    ).toBe('ANALYSIS_NOT_VERIFIED');
    expect(
      describeAnalysisFailure(new AnalysisResponseParseError('bad json')).code,
    ).toBe('ANALYSIS_NOT_VERIFIED');
  });
});
