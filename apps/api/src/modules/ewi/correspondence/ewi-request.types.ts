import type { EwiEmailTemplateId } from './ewi-email.templates';

export const EWI_REQUEST_TYPES = [
  'foia',
  'university_file',
  'graduation_announcement',
  'university_employment',
  'follow_up',
  'trialsmith',
] as const;

export type EwiRequestType = (typeof EWI_REQUEST_TYPES)[number];

export const EWI_REQUEST_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'queued',
  'sent',
  'logged_not_sent',
  'failed',
  'cancelled',
  'needs_manual_review',
] as const;

export type EwiRequestStatus = (typeof EWI_REQUEST_STATUSES)[number];

export const REQUEST_TYPE_TO_TEMPLATE: Record<
  EwiRequestType,
  EwiEmailTemplateId
> = {
  foia: 'foia-request',
  university_file: 'university-record-request',
  graduation_announcement: 'graduation-announcement',
  university_employment: 'university-employment-request',
  follow_up: 'follow-up-request',
  trialsmith: 'trialsmith-outreach',
};

export interface EwiRequestTarget {
  type: EwiRequestType;
  organizationName: string;
  /** Required for automated send. Unknown recipients go to manual review. */
  recipientEmail?: string | null;
  recipientName?: string | null;
  requestDescription?: string | null;
  recordType?: string | null;
  dateRange?: string | null;
  claimedDegree?: string | null;
  claimedYear?: string | null;
  employmentRole?: string | null;
  activityDescription?: string | null;
  requestPurpose?: string | null;
  originalSubject?: string | null;
  originalSentDate?: string | null;
  parentRequestId?: string | null;
  /** When true, skip automation even if config allows the type. */
  forceManualReview?: boolean;
}

export interface EwiRequestPlanInput {
  investigationId: string;
  expertName: string;
  city: string;
  specialty: string;
  caseReference?: string;
  senderName?: string;
  targets: EwiRequestTarget[];
}

export interface EwiRequestEligibility {
  canPrepare: boolean;
  canSend: boolean;
  requiresManualReview: boolean;
  reasons: string[];
}

export interface EwiRequestRecordView {
  id: string;
  investigationId: string;
  requestType: EwiRequestType;
  status: EwiRequestStatus;
  organizationName: string;
  recipientEmail: string | null;
  recipientName: string | null;
  subject: string;
  bodyText: string;
  templateId: string;
  caseReference: string;
  followUpAt: string | null;
  parentRequestId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
  provider: string | null;
  providerMessageId: string | null;
  delivered: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
