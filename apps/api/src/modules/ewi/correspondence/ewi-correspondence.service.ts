import { Injectable } from '@nestjs/common';
import { EmailDeliveryError } from '@platform/email/email.errors';
import { EmailService } from '@platform/email/email.service';
import type {
  EmailAttachment,
  EmailMessage,
  EmailSendResult,
} from '@platform/email/email.types';
import {
  EWI_EMAIL_TEMPLATES,
  resolveEwiEmailTemplateId,
  renderEwiEmailTemplate,
  type EwiEmailTemplateId,
} from './ewi-email.templates';

export interface EwiCorrespondenceInput {
  kind: EwiEmailTemplateId | 'graduation-verification';
  to: string;
  expertName: string;
  organizationName: string;
  caseReference: string;
  senderName: string;
  recipientName?: string;
  requestDescription?: string;
  recordType?: string;
  dateRange?: string;
  claimedDegree?: string;
  claimedYear?: string;
  employmentRole?: string;
  activityDescription?: string;
  requestPurpose?: string;
  originalSubject?: string;
  originalSentDate?: string;
  /** Only materials the client is allowed to transmit. Do not attach restricted research files. */
  attachments?: EmailAttachment[];
}

/**
 * Builds EWI request emails from templates.
 * Delivery goes through EmailService. Investigation jobs prepare drafts through
 * EwiRequestWorkflowService and do not send unless configured and authorized.
 */
@Injectable()
export class EwiCorrespondenceService {
  constructor(private readonly email: EmailService) {}

  compose(input: EwiCorrespondenceInput): EmailMessage {
    const kind = resolveEwiEmailTemplateId(input.kind);
    if (!kind) {
      throw new EmailDeliveryError(
        'Unknown EWI email template.',
        'validation',
        false,
      );
    }
    const template = EWI_EMAIL_TEMPLATES[kind];
    const variables = variablesFor(input);
    const missing = template.required.filter((key) => !variables[key]?.trim());
    if (missing.length > 0) {
      throw new EmailDeliveryError(
        `Missing email fields: ${missing.join(', ')}.`,
        'validation',
        false,
      );
    }
    const rendered = renderEwiEmailTemplate(template, variables);
    return {
      to: input.to.trim(),
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: input.attachments,
      templateId: template.id,
    };
  }

  /**
   * Explicit send for an approved workflow. Not called unless gates pass.
   */
  deliver(input: EwiCorrespondenceInput): Promise<EmailSendResult> {
    return this.email.send(this.compose(input));
  }
}

function variablesFor(input: EwiCorrespondenceInput): Record<string, string> {
  return {
    recipientName: input.recipientName?.trim() || 'Records Office',
    organizationName: input.organizationName.trim(),
    expertName: input.expertName.trim(),
    caseReference: input.caseReference.trim(),
    senderName: input.senderName.trim(),
    requestDescription: input.requestDescription?.trim() ?? '',
    recordType: input.recordType?.trim() ?? '',
    dateRange: input.dateRange?.trim() ?? '',
    claimedDegree: input.claimedDegree?.trim() ?? '',
    claimedYear: input.claimedYear?.trim() ?? '',
    employmentRole: input.employmentRole?.trim() ?? '',
    activityDescription: input.activityDescription?.trim() ?? '',
    requestPurpose: input.requestPurpose?.trim() ?? '',
    originalSubject: input.originalSubject?.trim() ?? '',
    originalSentDate: input.originalSentDate?.trim() ?? '',
  };
}
