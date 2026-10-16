import type { EmailSettings } from '@config/config.types';
import { EmailDeliveryError } from '../email.errors';
import type {
  EmailSendResult,
  IEmailProvider,
  OutboundEmail,
} from '../email.types';

const RESEND_URL = 'https://api.resend.com/emails';

interface ResendSuccess {
  id?: string;
}

/**
 * Resend HTTP API. Selected only when EMAIL_PROVIDER=resend.
 */
export class ResendEmailProvider implements IEmailProvider {
  readonly name = 'resend' as const;

  constructor(
    private readonly settings: Pick<EmailSettings, 'resendApiKey'>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    if (!this.settings.resendApiKey) {
      throw new EmailDeliveryError(
        'Resend is selected but RESEND_API_KEY is empty. No message was sent.',
        'configuration',
        false,
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toResendBody(message)),
      });
    } catch {
      throw new EmailDeliveryError(
        'Resend could not be reached. No message was confirmed.',
        'transient',
        true,
      );
    }

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as ResendSuccess;
      return {
        provider: 'resend',
        messageId: body.id?.trim() || 'resend-sent',
        delivered: true,
      };
    }

    const retryable = response.status === 429 || response.status >= 500;
    throw new EmailDeliveryError(
      `Resend refused the message (HTTP ${response.status}).`,
      retryable ? 'transient' : 'rejected',
      retryable,
    );
  }
}

function toResendBody(message: OutboundEmail): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: message.from,
    to: message.to,
    subject: message.subject,
  };
  if (message.cc.length > 0) body.cc = message.cc;
  if (message.bcc.length > 0) body.bcc = message.bcc;
  if (message.replyTo) body.reply_to = message.replyTo;
  if (message.text) body.text = message.text;
  if (message.html) body.html = message.html;
  if (message.attachments.length > 0) {
    body.attachments = message.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content).toString('base64'),
      content_type: attachment.contentType,
    }));
  }
  return body;
}
