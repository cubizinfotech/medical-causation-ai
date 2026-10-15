import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import { describeInvestigationFailure } from './ewi-investigation.processor';

describe('describeInvestigationFailure', () => {
  it('explains AI provider problems in plain words', () => {
    expect(
      describeInvestigationFailure(
        new RateLimitExceededException('gemini', 1000),
      ),
    ).toMatchObject({
      code: 'AI_BUSY',
      message: expect.stringContaining('the investigation') as unknown,
    });
    expect(
      describeInvestigationFailure(
        new ProviderUnavailableException('gemini', 'bad key', 'auth'),
      ).code,
    ).toBe('AI_CONFIGURATION');
  });

  it('never passes internal error text to the attorney', () => {
    const failure = describeInvestigationFailure(
      new Error('Invalid `prisma.expertInvestigation.update()` invocation'),
    );
    expect(failure.code).toBe('INVESTIGATION_FAILED');
    expect(failure.message).not.toMatch(/prisma|invocation/);
  });
});
