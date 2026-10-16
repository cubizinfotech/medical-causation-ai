import type { EmailProviderName, EmailSettings } from '@config/config.types';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const UNCONFIRMED_FROM = new Set(['noreply@localhost']);

/**
 * Chooses the adapter that may run.
 * SMTP sends when delivery is on, the From address is a real mailbox, and the
 * host is set. A local host such as Mailpit is allowed without that check.
 * An unconfirmed From address is logged instead of sent.
 */
export function selectEmailProvider(
  settings: EmailSettings,
  nodeEnv: string | undefined,
): EmailProviderName {
  if (!settings.deliveryEnabled || settings.provider === 'console') {
    return 'console';
  }
  if (settings.provider === 'transactional') return 'transactional';
  if (settings.provider === 'resend') {
    return isConfirmedSender(settings.from) && settings.resendApiKey
      ? 'resend'
      : 'console';
  }
  if (settings.provider !== 'smtp') return 'console';

  const host = settings.host.trim().toLowerCase();
  if (!host) return 'console';
  if (LOCAL_HOSTS.has(host)) {
    return nodeEnv === 'production' ? 'console' : 'smtp';
  }
  return isConfirmedSender(settings.from) ? 'smtp' : 'console';
}

export function isConfirmedSender(from: string): boolean {
  const value = from.trim().toLowerCase();
  if (!value.includes('@')) return false;
  if (UNCONFIRMED_FROM.has(value)) return false;
  if (value.endsWith('@example.com') || value.endsWith('@example.org')) {
    return false;
  }
  return true;
}
