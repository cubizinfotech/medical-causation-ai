/**
 * Shared email delivery abstraction (future).
 * Providers (SMTP, SES, etc.) plug in behind this interface.
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface IEmailService {
  send(message: EmailMessage): Promise<void>;
}
