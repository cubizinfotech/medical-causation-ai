import { ewiRequestConfig } from '@config/ewi-request.config';
import { evaluateRequestEligibility } from './ewi-request-policy';

const baseEmail = {
  provider: 'console' as const,
  deliveryEnabled: false,
  from: 'noreply@localhost',
  fromName: '',
  replyTo: '',
  redirectTo: '',
  host: 'localhost',
  port: 1025,
  user: '',
  password: '',
  secure: false,
  maxAttempts: 3,
  retryDelayMs: 500,
};

describe('ewi request policy', () => {
  const enabled = {
    ...ewiRequestConfig(),
    enabled: true,
    requireApproval: true,
    autoSend: false,
    trialsmithEnabled: false,
  };

  it('blocks send when the workflow is disabled', () => {
    const result = evaluateRequestEligibility({
      requestType: 'foia',
      recipientEmail: 'records@agency.gov',
      status: 'approved',
      config: { ...enabled, enabled: false },
      email: baseEmail,
    });
    expect(result.canPrepare).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/not enabled/i);
  });

  it('requires manual review when the recipient is unknown', () => {
    const result = evaluateRequestEligibility({
      requestType: 'university_file',
      recipientEmail: null,
      status: 'draft',
      config: enabled,
      email: baseEmail,
    });
    expect(result.requiresManualReview).toBe(true);
    expect(result.canSend).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/recipient/i);
  });

  it('does not allow TrialSmith unless specifically configured', () => {
    const result = evaluateRequestEligibility({
      requestType: 'trialsmith',
      recipientEmail: 'contact@example.org',
      status: 'approved',
      config: enabled,
      email: baseEmail,
    });
    expect(result.requiresManualReview).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/TrialSmith/i);
  });

  it('allows console send for an approved FOIA with a known recipient', () => {
    const result = evaluateRequestEligibility({
      requestType: 'foia',
      recipientEmail: 'records@agency.gov',
      status: 'approved',
      config: enabled,
      email: baseEmail,
    });
    expect(result.requiresManualReview).toBe(false);
    expect(result.canSend).toBe(true);
  });
});
