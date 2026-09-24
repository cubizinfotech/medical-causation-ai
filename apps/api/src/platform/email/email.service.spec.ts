import { Logger } from '@nestjs/common';
import type { EmailSettings } from '@config/config.types';
import { EmailDeliveryError } from './email.errors';
import { EmailProviderFactory } from './email-provider.factory';
import { EmailService } from './email.service';
import type { IEmailProvider } from './email.types';

const baseSettings: EmailSettings = {
  provider: 'console',
  deliveryEnabled: false,
  from: 'noreply@localhost',
  fromName: '',
  replyTo: '',
  redirectTo: '',
  host: 'localhost',
  port: 1025,
  user: '',
  password: 'super-secret-pass',
  secure: false,
  maxAttempts: 3,
  retryDelayMs: 0,
};

function service(settings: EmailSettings, provider: IEmailProvider) {
  const config = { get: jest.fn(() => settings) };
  const factory = {
    create: jest.fn(() => provider),
  } as unknown as EmailProviderFactory;
  return {
    email: new EmailService(config as never, factory),
    factory,
  };
}

describe('EmailService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs through the console provider and does not mark the message delivered', async () => {
    const lines: string[] = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((...parts: unknown[]) => {
        lines.push(parts.map((part) => String(part)).join(' '));
      });
    const send = jest.fn(() =>
      Promise.resolve({
        provider: 'console' as const,
        messageId: 'console-1',
        delivered: false,
      }),
    );
    const provider: IEmailProvider = { name: 'console', send };
    const create = jest.fn(() => provider);
    const config = { get: jest.fn(() => baseSettings) };
    const email = new EmailService(config as never, { create });
    const result = await email.send({
      to: 'records@university.edu',
      subject: 'Request',
      text: 'Body',
      templateId: 'ewi/foia-request',
    });

    expect(result.delivered).toBe(false);
    expect(create).toHaveBeenCalledWith('console', baseSettings);
    expect(send).toHaveBeenCalledTimes(1);
    expect(lines.join('\n')).not.toContain('super-secret-pass');
  });

  it('retries a transient SMTP failure and then succeeds', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const send = jest
      .fn()
      .mockRejectedValueOnce(
        new EmailDeliveryError('timeout', 'transient', true),
      )
      .mockResolvedValueOnce({
        provider: 'smtp' as const,
        messageId: 'smtp-1',
        delivered: true,
      });
    const provider: IEmailProvider = { name: 'smtp', send };
    const { email } = service(
      {
        ...baseSettings,
        provider: 'smtp',
        deliveryEnabled: true,
        host: 'localhost',
      },
      provider,
    );

    try {
      const result = await email.send({
        to: 'inbox@localhost',
        subject: 'Request',
        text: 'Body',
      });
      expect(result.messageId).toBe('smtp-1');
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
    }
  });

  it('does not retry a configuration failure', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(
        new EmailDeliveryError('not connected', 'configuration', false),
      );
    const provider: IEmailProvider = { name: 'transactional', send };
    const { email } = service(
      {
        ...baseSettings,
        provider: 'transactional',
        deliveryEnabled: true,
      },
      provider,
    );

    await expect(
      email.send({
        to: 'records@university.edu',
        subject: 'Request',
        text: 'Body',
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
