import { ewiRequestConfig } from './ewi-request.config';

describe('ewiRequestConfig', () => {
  const keys = [
    'EWI_REQUEST_WORKFLOW_ENABLED',
    'EWI_REQUEST_AUTO_SEND',
    'EWI_REQUEST_REQUIRE_APPROVAL',
    'EWI_REQUEST_FOLLOW_UP_DAYS',
    'EWI_REQUEST_TRIALSMITH_ENABLED',
    'EWI_REQUEST_SENDER_NAME',
  ] as const;

  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults to disabled workflow without auto-send', () => {
    const config = ewiRequestConfig();
    expect(config.enabled).toBe(false);
    expect(config.autoSend).toBe(false);
    expect(config.requireApproval).toBe(true);
    expect(config.followUpDays).toBe(14);
    expect(config.trialsmithEnabled).toBe(false);
  });

  it('reads explicit enablement flags without requiring credentials', () => {
    process.env.EWI_REQUEST_WORKFLOW_ENABLED = 'true';
    process.env.EWI_REQUEST_TRIALSMITH_ENABLED = 'true';
    process.env.EWI_REQUEST_FOLLOW_UP_DAYS = '21';
    process.env.EWI_REQUEST_SENDER_NAME = 'Records Desk';
    const config = ewiRequestConfig();
    expect(config.enabled).toBe(true);
    expect(config.trialsmithEnabled).toBe(true);
    expect(config.followUpDays).toBe(21);
    expect(config.senderName).toBe('Records Desk');
  });
});
