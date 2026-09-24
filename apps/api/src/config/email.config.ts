import type { EmailProviderName, EmailSettings } from './config.types';

export const emailConfig = (): EmailSettings => {
  const provider = readProvider(process.env.EMAIL_PROVIDER);
  return {
    provider,
    deliveryEnabled:
      process.env.EMAIL_DELIVERY_ENABLED === 'true' ||
      process.env.FEATURE_EMAIL === 'true',
    from: process.env.EMAIL_FROM?.trim() || 'noreply@localhost',
    fromName: process.env.EMAIL_FROM_NAME?.trim() ?? '',
    replyTo: process.env.EMAIL_REPLY_TO?.trim() ?? '',
    redirectTo: process.env.EMAIL_REDIRECT_TO?.trim() ?? '',
    host: process.env.SMTP_HOST?.trim() || 'localhost',
    port: readInt(process.env.SMTP_PORT, 1025, 1, 65535),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    secure: process.env.SMTP_SECURE === 'true',
    maxAttempts: readInt(process.env.EMAIL_MAX_ATTEMPTS, 3, 1, 5),
    retryDelayMs: readInt(process.env.EMAIL_RETRY_DELAY_MS, 500, 0, 60_000),
  };
};

function readProvider(value: string | undefined): EmailProviderName {
  const provider = (value ?? 'console').trim().toLowerCase();
  if (provider === 'smtp' || provider === 'transactional') return provider;
  return 'console';
}

function readInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
