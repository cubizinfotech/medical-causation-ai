import type { EwiRequestWorkflowSettings } from '@config/config.types';
import type { EwiCorrespondenceInput } from './ewi-correspondence.service';
import { REQUEST_TYPE_TO_TEMPLATE } from './ewi-request.types';
import type {
  EwiRequestPlanInput,
  EwiRequestTarget,
  EwiRequestType,
} from './ewi-request.types';
import { evaluateRequestEligibility } from './ewi-request-policy';
import type { EmailSettings } from '@config/config.types';

export interface PreparedRequestDraft {
  requestType: EwiRequestType;
  organizationName: string;
  recipientEmail: string | null;
  recipientName: string | null;
  caseReference: string;
  parentRequestId: string | null;
  correspondence: EwiCorrespondenceInput;
  requiresManualReview: boolean;
  reasons: string[];
}

/**
 * Builds draft correspondence from structured investigation targets.
 * Does not invent recipients or send mail.
 */
export function prepareRequestDrafts(input: {
  plan: EwiRequestPlanInput;
  config: EwiRequestWorkflowSettings;
  email: EmailSettings;
  nodeEnv?: string;
}): PreparedRequestDraft[] {
  const caseReference =
    input.plan.caseReference?.trim() ||
    `EWI-${input.plan.investigationId.slice(0, 8)}`;
  const senderName = input.plan.senderName?.trim() || input.config.senderName;

  return input.plan.targets.map((target) =>
    draftForTarget({
      target,
      expertName: input.plan.expertName,
      caseReference,
      senderName,
      config: input.config,
      email: input.email,
      nodeEnv: input.nodeEnv,
    }),
  );
}

function draftForTarget(input: {
  target: EwiRequestTarget;
  expertName: string;
  caseReference: string;
  senderName: string;
  config: EwiRequestWorkflowSettings;
  email: EmailSettings;
  nodeEnv?: string;
}): PreparedRequestDraft {
  const eligibility = evaluateRequestEligibility({
    requestType: input.target.type,
    recipientEmail: input.target.recipientEmail,
    forceManualReview: input.target.forceManualReview,
    config: input.config,
    email: input.email,
    nodeEnv: input.nodeEnv,
  });

  const recipientEmail = input.target.recipientEmail?.trim() || null;
  const correspondence = correspondenceFor(input.target, {
    expertName: input.expertName,
    caseReference: input.caseReference,
    senderName: input.senderName,
    to: recipientEmail ?? 'manual-review@invalid.local',
  });

  return {
    requestType: input.target.type,
    organizationName: input.target.organizationName.trim(),
    recipientEmail,
    recipientName: input.target.recipientName?.trim() || null,
    caseReference: input.caseReference,
    parentRequestId: input.target.parentRequestId ?? null,
    correspondence,
    requiresManualReview: eligibility.requiresManualReview,
    reasons: eligibility.reasons,
  };
}

function correspondenceFor(
  target: EwiRequestTarget,
  base: {
    expertName: string;
    caseReference: string;
    senderName: string;
    to: string;
  },
): EwiCorrespondenceInput {
  const kind = REQUEST_TYPE_TO_TEMPLATE[target.type];
  return {
    kind,
    to: base.to,
    expertName: base.expertName,
    organizationName: target.organizationName.trim(),
    caseReference: base.caseReference,
    senderName: base.senderName,
    recipientName: target.recipientName?.trim() || undefined,
    requestDescription:
      target.requestDescription?.trim() || defaultFoiaDescription(target),
    recordType: target.recordType?.trim() || undefined,
    dateRange: target.dateRange?.trim() || undefined,
    claimedDegree: target.claimedDegree?.trim() || undefined,
    claimedYear: target.claimedYear?.trim() || undefined,
    employmentRole: target.employmentRole?.trim() || undefined,
    activityDescription: target.activityDescription?.trim() || undefined,
    requestPurpose: target.requestPurpose?.trim() || undefined,
    originalSubject: target.originalSubject?.trim() || undefined,
    originalSentDate: target.originalSentDate?.trim() || undefined,
  };
}

function defaultFoiaDescription(target: EwiRequestTarget): string {
  if (target.type !== 'foia') return '';
  return `Please provide discoverable public information regarding the named expert that your office is authorized to release.`;
}
