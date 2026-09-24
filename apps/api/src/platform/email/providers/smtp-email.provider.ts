import type { EmailSettings } from '@config/config.types';
import { EmailDeliveryError } from '../email.errors';
import type {
  EmailAttachment,
  EmailSendResult,
  IEmailProvider,
  OutboundEmail,
} from '../email.types';

export interface SmtpTransport {
  sendMail(mail: SmtpMail): Promise<{ messageId?: string }>;
}

export interface SmtpMail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * SMTP adapter. Credentials come from EmailSettings, which is loaded from the environment.
 */
export class SmtpEmailProvider implements IEmailProvider {
  readonly name = 'smtp' as const;

  constructor(
    private readonly settings: Pick<
      EmailSettings,
      'host' | 'port' | 'secure' | 'user' | 'password'
    >,
    private readonly transport?: SmtpTransport,
  ) {}

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    const transport =
      this.transport ?? (await createSmtpTransport(this.settings));
    try {
      const result = await transport.sendMail(toSmtpMail(message));
      return {
        provider: 'smtp',
        messageId: result.messageId?.trim() || 'smtp-sent',
        delivered: true,
      };
    } catch (error) {
      throw toDeliveryError(error);
    }
  }
}

export async function createSmtpTransport(
  settings: Pick<
    EmailSettings,
    'host' | 'port' | 'secure' | 'user' | 'password'
  >,
): Promise<SmtpTransport> {
  const imported = (await import('nodemailer')) as {
    default?: { createTransport: (options: object) => SmtpTransport };
    createTransport?: (options: object) => SmtpTransport;
  };
  const factory = imported.createTransport ?? imported.default?.createTransport;
  if (!factory) {
    throw new EmailDeliveryError(
      'SMTP transport is unavailable.',
      'configuration',
      false,
    );
  }
  return factory({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user
      ? { user: settings.user, pass: settings.password }
      : undefined,
  });
}

function toSmtpMail(message: OutboundEmail): SmtpMail {
  return {
    from: message.from,
    to: message.to,
    cc: message.cc.length > 0 ? message.cc : undefined,
    bcc: message.bcc.length > 0 ? message.bcc : undefined,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments.map(toSmtpAttachment),
  };
}

function toSmtpAttachment(attachment: EmailAttachment): {
  filename: string;
  content: Buffer | string;
  contentType?: string;
} {
  return {
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType,
  };
}

function toDeliveryError(error: unknown): EmailDeliveryError {
  if (error instanceof EmailDeliveryError) return error;
  const code = readCode(error);
  const responseCode = readResponseCode(error);
  const retryable =
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'EAI_AGAIN' ||
    (responseCode >= 400 && responseCode < 500);
  const message =
    error instanceof Error ? error.message : 'SMTP delivery failed';
  return new EmailDeliveryError(
    message,
    retryable ? 'transient' : 'rejected',
    retryable,
  );
}

function readCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return '';
  return String(error.code);
}

function readResponseCode(error: unknown): number {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('responseCode' in error)
  ) {
    return 0;
  }
  const value = Number(error.responseCode);
  return Number.isFinite(value) ? value : 0;
}
