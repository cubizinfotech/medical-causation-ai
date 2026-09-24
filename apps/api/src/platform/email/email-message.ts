import type { EmailSettings } from '@config/config.types';
import { EmailDeliveryError } from './email.errors';
import type {
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  OutboundEmail,
} from './email.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALHOST_PATTERN = /^[^\s@]+@localhost$/;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

export function normalizeOutboundEmail(
  message: EmailMessage,
  settings: Pick<EmailSettings, 'from' | 'fromName' | 'replyTo' | 'redirectTo'>,
): OutboundEmail {
  const subject = message.subject.replace(/\s+/g, ' ').trim();
  if (!subject) {
    throw new EmailDeliveryError(
      'Email subject is required.',
      'validation',
      false,
    );
  }
  const text = message.text?.trim();
  const html = message.html?.trim();
  if (!text && !html) {
    throw new EmailDeliveryError(
      'Email body must include text or HTML.',
      'validation',
      false,
    );
  }

  const originalTo = parseAddressList(message.to, 'to');
  const cc = parseAddressList(message.cc, 'cc');
  const bcc = parseAddressList(message.bcc, 'bcc');
  const from = formatSender(settings.from, settings.fromName);
  if (!from) {
    throw new EmailDeliveryError(
      'EMAIL_FROM is required.',
      'configuration',
      false,
    );
  }

  const replyTo = settings.replyTo.trim();
  if (replyTo && !isEmailAddress(replyTo)) {
    throw new EmailDeliveryError(
      'EMAIL_REPLY_TO is not a valid email address.',
      'configuration',
      false,
    );
  }

  const redirectTo = settings.redirectTo.trim();
  let to = originalTo;
  let redirected = false;
  if (redirectTo) {
    if (!isEmailAddress(redirectTo)) {
      throw new EmailDeliveryError(
        'EMAIL_REDIRECT_TO is not a valid email address.',
        'configuration',
        false,
      );
    }
    to = [redirectTo];
    redirected = true;
  }

  return {
    from,
    replyTo: replyTo || undefined,
    to,
    cc: redirected ? [] : cc,
    bcc: redirected ? [] : bcc,
    originalTo,
    redirected,
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: normalizeAttachments(message.attachments ?? []),
    templateId: message.templateId?.trim() || undefined,
  };
}

export function formatSender(from: string, fromName: string): string {
  const email = from.trim();
  if (!email) return '';
  if (!isEmailAddress(email)) {
    throw new EmailDeliveryError(
      'EMAIL_FROM is not a valid email address.',
      'configuration',
      false,
    );
  }
  const name = fromName.trim();
  if (!name) return email;
  return `${name} <${email}>`;
}

export function formatConsoleEmail(message: OutboundEmail): string {
  const attachmentLines = message.attachments.map((attachment) => {
    const bytes = attachmentSize(attachment);
    return `- ${attachment.filename} (${attachment.contentType ?? 'application/octet-stream'}, ${bytes} bytes)`;
  });
  const lines = [
    'Email logged and not sent to an external provider.',
    `Template: ${message.templateId ?? '-'}`,
    `From: ${message.from}`,
    `To: ${message.to.join(', ')}`,
  ];
  if (message.redirected) {
    lines.push(`Original-To: ${message.originalTo.join(', ')}`);
    lines.push('Recipients were replaced by EMAIL_REDIRECT_TO.');
  }
  if (message.cc.length > 0) lines.push(`Cc: ${message.cc.join(', ')}`);
  if (message.replyTo) lines.push(`Reply-To: ${message.replyTo}`);
  lines.push(`Subject: ${message.subject}`, '---');
  lines.push(message.text ?? message.html ?? '');
  if (attachmentLines.length > 0) {
    lines.push('Attachments:', ...attachmentLines);
  }
  return lines.join('\n');
}

function parseAddressList(
  value: EmailMessage['to'] | undefined,
  label: string,
): string[] {
  if (value === undefined) {
    if (label === 'to') {
      throw new EmailDeliveryError(
        'At least one recipient is required.',
        'validation',
        false,
      );
    }
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  if (label === 'to' && items.length === 0) {
    throw new EmailDeliveryError(
      'At least one recipient is required.',
      'validation',
      false,
    );
  }
  return items.map((item) => formatRecipient(item, label));
}

function formatRecipient(value: string | EmailAddress, label: string): string {
  if (typeof value === 'string') {
    const email = value.trim();
    assertEmail(email, label);
    return email;
  }
  const email = value.email.trim();
  assertEmail(email, label);
  const name = value.name?.trim();
  return name ? `${name} <${email}>` : email;
}

function assertEmail(email: string, label: string): void {
  if (!isEmailAddress(email)) {
    throw new EmailDeliveryError(
      `Invalid ${label} email address.`,
      'validation',
      false,
    );
  }
}

function isEmailAddress(email: string): boolean {
  return EMAIL_PATTERN.test(email) || LOCALHOST_PATTERN.test(email);
}

function normalizeAttachments(
  attachments: EmailAttachment[],
): EmailAttachment[] {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new EmailDeliveryError(
      `An email can include at most ${MAX_ATTACHMENTS} attachments.`,
      'validation',
      false,
    );
  }
  return attachments.map((attachment) => {
    const filename = attachment.filename.trim();
    if (!filename || /[\\/]/.test(filename)) {
      throw new EmailDeliveryError(
        'Attachment filename must be a single file name.',
        'validation',
        false,
      );
    }
    const bytes = attachmentSize(attachment);
    if (bytes <= 0) {
      throw new EmailDeliveryError(
        `Attachment ${filename} is empty.`,
        'validation',
        false,
      );
    }
    if (bytes > MAX_ATTACHMENT_BYTES) {
      throw new EmailDeliveryError(
        `Attachment ${filename} exceeds 10 MB.`,
        'validation',
        false,
      );
    }
    return {
      filename,
      content: attachment.content,
      contentType: attachment.contentType?.trim() || undefined,
    };
  });
}

function attachmentSize(attachment: EmailAttachment): number {
  if (typeof attachment.content === 'string') {
    return Buffer.byteLength(attachment.content);
  }
  return attachment.content.length;
}
