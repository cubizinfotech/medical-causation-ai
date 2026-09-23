import type { EmailSettings } from './config.types';

export const emailConfig = (): EmailSettings => {
  const provider = (process.env.EMAIL_PROVIDER ?? 'console')
    .trim()
    .toLowerCase();
  return {
    provider: provider === 'smtp' ? 'smtp' : 'console',
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.EMAIL_FROM ?? 'noreply@localhost',
    secure: process.env.SMTP_SECURE === 'true',
  };
};
