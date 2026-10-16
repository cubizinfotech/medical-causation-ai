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
    resendApiKey: '',
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

  it('allows a confirmed SMTP host in development and still blocks an unconfirmed From address', () => {
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
          host: 'smtp.gmail.com',
          from: 'records@client.example',
        }),
        'development',
      ),
    ).toBe('smtp');
    expect(
      selectEmailProvider(
        settings({
          provider: 'smtp',
          deliveryEnabled: true,
          host: 'smtp.gmail.com',
          from: 'noreply@localhost',
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

  it('sends with Resend when delivery is on, the sender is confirmed, and a key is set', () => {
    expect(
      selectEmailProvider(
        settings({
          provider: 'resend',
          deliveryEnabled: true,
          from: 'records@client.example',
          resendApiKey: 're_test',
        }),
        'production',
      ),
    ).toBe('resend');
    expect(
      selectEmailProvider(
        settings({
          provider: 'resend',
          deliveryEnabled: true,
          from: 'records@client.example',
        }),
        'development',
      ),
    ).toBe('console');
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
