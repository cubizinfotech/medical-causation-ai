import type { EmailSettings } from '@config/config.types';
import { isConfirmedSender, selectEmailProvider } from './email-policy';

function settings(overrides: Partial<EmailSettings> = {}): EmailSettings {
  return {
    provider: 'console',
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
    retryDelayMs: 0,
    ...overrides,
  };
}

describe('selectEmailProvider', () => {
  it('keeps the console provider when delivery is off', () => {
    expect(
      selectEmailProvider(
        settings({ provider: 'smtp', deliveryEnabled: false }),
        'development',
      ),
    ).toBe('console');
  });

  it('allows SMTP only to a local host outside production', () => {
    expect(
      selectEmailProvider(
        settings({
          provider: 'smtp',
          deliveryEnabled: true,
          host: 'localhost',
        }),
        'development',
      ),
    ).toBe('smtp');
    expect(
      selectEmailProvider(
        settings({
          provider: 'smtp',
          deliveryEnabled: true,
          host: 'smtp.client.example',
          from: 'records@client.example',
        }),
        'development',
      ),
    ).toBe('console');
  });

  it('allows production SMTP only for a confirmed sender and a non-local host', () => {
    expect(
      selectEmailProvider(
        settings({
          provider: 'smtp',
          deliveryEnabled: true,
          host: 'smtp.client.example',
          from: 'records@client.example',
        }),
        'production',
      ),
    ).toBe('smtp');
    expect(
      selectEmailProvider(
        settings({
          provider: 'smtp',
          deliveryEnabled: true,
          host: 'localhost',
          from: 'records@client.example',
        }),
        'production',
      ),
    ).toBe('console');
    expect(isConfirmedSender('noreply@localhost')).toBe(false);
    expect(isConfirmedSender('user@example.com')).toBe(false);
  });

  it('selects the transactional seam only when delivery is enabled', () => {
    expect(
      selectEmailProvider(
        settings({ provider: 'transactional', deliveryEnabled: true }),
        'production',
      ),
    ).toBe('transactional');
  });
});
