import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmailSettings,
  EwiRequestWorkflowSettings,
} from '@config/config.types';
import { emailConfig } from '@config/email.config';
import { ewiRequestConfig } from '@config/ewi-request.config';
import { EmailService } from '@platform/email/email.service';
import { EwiCorrespondenceService } from './ewi-correspondence.service';
import { prepareRequestDrafts } from './ewi-request-planner';
import {
  evaluateRequestEligibility,
  isValidRecipientEmail,
} from './ewi-request-policy';
import { EwiRequestRepository } from './ewi-request.repository';
import type {
  EwiRequestPlanInput,
  EwiRequestRecordView,
  EwiRequestTarget,
} from './ewi-request.types';

/**
 * Prepares, approves, and optionally sends FOIA / university / outreach requests.
 * Never hardcodes recipients or credentials. Local default uses the console
 * email provider and does not transmit messages.
 */
@Injectable()
export class EwiRequestWorkflowService {
  private readonly logger = new Logger(EwiRequestWorkflowService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly correspondence: EwiCorrespondenceService,
    private readonly email: EmailService,
    private readonly requests: EwiRequestRepository,
  ) {}

  listForInvestigation(
    investigationId: string,
  ): Promise<EwiRequestRecordView[]> {
    return this.requests.listForInvestigation(investigationId);
  }

  getRequest(id: string): Promise<EwiRequestRecordView> {
    return this.requests.requireById(id);
  }

  /**
   * Compose and persist drafts from structured investigation targets.
   * Does not send unless auto-send gates pass after preparation.
   */
  async prepare(plan: EwiRequestPlanInput): Promise<EwiRequestRecordView[]> {
    const settings = this.workflowSettings();
    if (!settings.enabled) {
      this.logger.log(
        `EWI request workflow disabled; skipping prepare for investigation=${plan.investigationId}`,
      );
      return [];
    }

    const drafts = prepareRequestDrafts({
      plan,
      config: settings,
      email: this.emailSettings(),
      nodeEnv: process.env.NODE_ENV,
    });

    const created: EwiRequestRecordView[] = [];
    for (const draft of drafts) {
      const message = this.correspondence.compose(draft.correspondence);
      const initialStatus = draft.requiresManualReview
        ? 'needs_manual_review'
        : settings.requireApproval
          ? 'pending_approval'
          : 'approved';

      const record = await this.requests.create({
        investigationId: plan.investigationId,
        requestType: draft.requestType,
        status: initialStatus,
        organizationName: draft.organizationName,
        recipientEmail: draft.recipientEmail,
        recipientName: draft.recipientName,
        subject: message.subject,
        bodyText: message.text ?? '',
        templateId: message.templateId ?? `ewi/${draft.correspondence.kind}`,
        caseReference: draft.caseReference,
        followUpAt: null,
        parentRequestId: draft.parentRequestId,
        metadata: {
          reasons: draft.reasons,
          expertName: plan.expertName,
          city: plan.city,
          specialty: plan.specialty,
        },
      });

      this.logger.log(
        `Prepared EWI request id=${record.id} type=${record.requestType} status=${record.status} investigation=${plan.investigationId} recipient=${maskRecipient(record.recipientEmail)}`,
      );

      if (
        !draft.requiresManualReview &&
        settings.autoSend &&
        !settings.requireApproval
      ) {
        created.push(await this.sendIfEligible(record.id));
      } else {
        created.push(record);
      }
    }
    return created;
  }

  async approve(
    requestId: string,
    approvedBy = 'operator',
  ): Promise<EwiRequestRecordView> {
    const current = await this.requests.requireById(requestId);
    if (
      current.status === 'needs_manual_review' &&
      !isValidRecipientEmail(current.recipientEmail)
    ) {
      return this.requests.update(requestId, {
        status: 'needs_manual_review',
        errorMessage:
          'Approve is blocked until a valid recipient is supplied through manual review.',
      });
    }
    return this.requests.update(requestId, {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: approvedBy.trim() || 'operator',
      errorMessage: null,
    });
  }

  /**
   * Send an approved request when gates pass. Uses EmailService (console locally).
   */
  async sendIfEligible(requestId: string): Promise<EwiRequestRecordView> {
    const current = await this.requests.requireById(requestId);
    const settings = this.workflowSettings();
    const email = this.emailSettings();
    const statusForGate =
      current.status === 'approved' || current.status === 'queued'
        ? 'approved'
        : current.status;

    const eligibility = evaluateRequestEligibility({
      requestType: current.requestType,
      recipientEmail: current.recipientEmail,
      status: statusForGate,
      config: {
        ...settings,
        // When requiring approval, treat only explicit approved status as approved.
        requireApproval: settings.requireApproval,
        autoSend: settings.autoSend,
      },
      email,
      nodeEnv: process.env.NODE_ENV,
    });

    if (!settings.enabled) {
      return this.requests.update(requestId, {
        status: 'needs_manual_review',
        errorMessage: 'Request workflow is not enabled.',
      });
    }

    if (eligibility.requiresManualReview || !current.recipientEmail) {
      return this.requests.update(requestId, {
        status: 'needs_manual_review',
        errorMessage: eligibility.reasons.join(' '),
      });
    }

    if (settings.requireApproval && current.status !== 'approved') {
      return this.requests.update(requestId, {
        status:
          current.status === 'pending_approval'
            ? 'pending_approval'
            : current.status,
        errorMessage: 'Request must be approved before send.',
      });
    }

    if (!eligibility.canSend) {
      return this.requests.update(requestId, {
        status: 'needs_manual_review',
        errorMessage:
          eligibility.reasons.join(' ') || 'Send requirements not met.',
      });
    }

    await this.requests.update(requestId, {
      status: 'queued',
      errorMessage: null,
    });

    try {
      const sendResult = await this.email.send({
        to: current.recipientEmail,
        subject: current.subject,
        text: current.bodyText,
        templateId: current.templateId,
      });

      const followUpAt = new Date();
      followUpAt.setDate(followUpAt.getDate() + settings.followUpDays);

      const status = sendResult.delivered ? 'sent' : 'logged_not_sent';
      const updated = await this.requests.update(requestId, {
        status,
        sentAt: new Date(),
        provider: sendResult.provider,
        providerMessageId: sendResult.messageId,
        delivered: sendResult.delivered,
        followUpAt,
        errorMessage: null,
      });

      this.logger.log(
        `EWI request ${status} id=${updated.id} type=${updated.requestType} investigation=${updated.investigationId} recipient=${maskRecipient(updated.recipientEmail)} delivered=${updated.delivered} followUpAt=${updated.followUpAt}`,
      );
      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Email delivery failed';
      this.logger.error(
        `EWI request send failed id=${requestId} reason=${message}`,
      );
      return this.requests.update(requestId, {
        status: 'failed',
        errorMessage: message,
        delivered: false,
      });
    }
  }

  /**
   * Update recipient after manual review, then move to pending_approval or approved.
   */
  async completeManualReview(input: {
    requestId: string;
    recipientEmail: string;
    recipientName?: string;
    approvedBy?: string;
    approve?: boolean;
  }): Promise<EwiRequestRecordView> {
    if (!isValidRecipientEmail(input.recipientEmail)) {
      return this.requests.update(input.requestId, {
        status: 'needs_manual_review',
        errorMessage: 'Recipient email is invalid.',
      });
    }
    const settings = this.workflowSettings();
    const approveNow = input.approve === true || !settings.requireApproval;
    await this.requests.update(input.requestId, {
      recipientEmail: input.recipientEmail.trim(),
      recipientName: input.recipientName?.trim() || null,
      status: approveNow ? 'approved' : 'pending_approval',
      errorMessage: null,
      approvedAt: approveNow ? new Date() : null,
      approvedBy: approveNow ? input.approvedBy?.trim() || 'operator' : null,
    });
    return this.requests.requireById(input.requestId);
  }

  /**
   * Create a follow-up draft that references the original request.
   */
  async createFollowUp(
    parentRequestId: string,
  ): Promise<EwiRequestRecordView | null> {
    const parent = await this.requests.requireById(parentRequestId);
    if (parent.status !== 'sent' && parent.status !== 'logged_not_sent') {
      this.logger.log(
        `Skip follow-up; parent request ${parentRequestId} was not sent.`,
      );
      return null;
    }

    const target: EwiRequestTarget = {
      type: 'follow_up',
      organizationName: parent.organizationName,
      recipientEmail: parent.recipientEmail,
      recipientName: parent.recipientName,
      originalSubject: parent.subject,
      originalSentDate: parent.sentAt
        ? parent.sentAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      parentRequestId: parent.id,
    };

    const created = await this.prepare({
      investigationId: parent.investigationId,
      expertName: 'Expert',
      city: '',
      specialty: '',
      caseReference: parent.caseReference,
      targets: [target],
    });
    return created[0] ?? null;
  }

  /**
   * Prepare follow-ups for requests whose follow-up date has passed.
   */
  async processDueFollowUps(
    asOf = new Date(),
  ): Promise<EwiRequestRecordView[]> {
    const due = await this.requests.listDueFollowUps(asOf);
    const created: EwiRequestRecordView[] = [];
    for (const parent of due) {
      const followUp = await this.createFollowUp(parent.id);
      if (followUp) created.push(followUp);
    }
    return created;
  }

  private workflowSettings(): EwiRequestWorkflowSettings {
    return (
      this.config.get<EwiRequestWorkflowSettings>('ewiRequest') ??
      ewiRequestConfig()
    );
  }

  private emailSettings(): EmailSettings {
    return this.config.get<EmailSettings>('email') ?? emailConfig();
  }
}

/** Log recipients without dumping full addresses into noisy aggregate logs when absent. */
function maskRecipient(email: string | null): string {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return 'invalid';
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}
