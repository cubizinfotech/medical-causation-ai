import type { EmailProviderName, EmailSettings } from '@config/config.types';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const UNCONFIRMED_FROM = new Set(['noreply@localhost']);

/**
 * Chooses the adapter that may run.
 * Outside production, SMTP is limited to a local catch-all such as Mailpit.
 * Any other host is logged and not sent. Transactional delivery stays a seam
 * until a vendor adapter is confirmed.
 */
export function selectEmailProvider(
  settings: EmailSettings,
  nodeEnv: string | undefined,
): EmailProviderName {
  if (!settings.deliveryEnabled || settings.provider === 'console') {
    return 'console';
  }
  if (settings.provider === 'transactional') return 'transactional';
  if (settings.provider !== 'smtp') return 'console';

  const host = settings.host.trim().toLowerCase();
  const local = LOCAL_HOSTS.has(host);
  if (nodeEnv === 'production') {
    if (!local && isConfirmedSender(settings.from) && host) return 'smtp';
    return 'console';
  }
  return local ? 'smtp' : 'console';
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
