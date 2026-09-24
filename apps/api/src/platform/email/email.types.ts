import type { EmailProviderName } from '@config/config.types';

/**
 * Shared email delivery. Business code depends on this contract.
 * Console, SMTP, and transactional adapters sit behind it.
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  /** Plain text or raw bytes. Restricted research documents must not be attached. */
  content: Buffer | string;
  contentType?: string;
}

export interface EmailMessage {
  to: string | string[] | EmailAddress | EmailAddress[];
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  /** Logged only. Not placed on the outbound message. */
  templateId?: string;
}

export interface OutboundEmail {
  from: string;
  replyTo?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  originalTo: string[];
  redirected: boolean;
  subject: string;
  text?: string;
  html?: string;
  attachments: EmailAttachment[];
  templateId?: string;
}

export interface EmailSendResult {
  provider: EmailProviderName;
  messageId: string;
  /** False when the message was logged and not transmitted. */
  delivered: boolean;
}

export interface IEmailProvider {
  readonly name: EmailProviderName;
  send(message: OutboundEmail): Promise<EmailSendResult>;
}

export interface IEmailService {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
