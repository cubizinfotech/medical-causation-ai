import type {
  EmailSettings,
  EwiRequestWorkflowSettings,
} from '@config/config.types';
import {
  isConfirmedSender,
  selectEmailProvider,
} from '@platform/email/email-policy';
import type {
  EwiRequestEligibility,
  EwiRequestStatus,
  EwiRequestType,
} from './ewi-request.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Gates for preparing and sending EWI requests.
 * Does not assume every government or university request can be automated.
 */
export function evaluateRequestEligibility(input: {
  requestType: EwiRequestType;
  recipientEmail: string | null | undefined;
  status?: EwiRequestStatus;
  forceManualReview?: boolean;
  config: EwiRequestWorkflowSettings;
  email: EmailSettings;
  nodeEnv?: string;
}): EwiRequestEligibility {
  const reasons: string[] = [];
  const recipient = input.recipientEmail?.trim() ?? '';
  const recipientKnown = EMAIL_PATTERN.test(recipient);

  if (!input.config.enabled) {
    reasons.push('Request workflow is not enabled.');
  }
  if (!typeAllowed(input.requestType, input.config)) {
    reasons.push(
      `Automated handling for ${input.requestType} is not authorized.`,
    );
  }
  if (input.requestType === 'trialsmith' && !input.config.trialsmithEnabled) {
    reasons.push('TrialSmith outreach is not specifically configured.');
  }
  if (!recipientKnown) {
    reasons.push('Recipient email is unknown. Manual review is required.');
  }
  if (input.forceManualReview) {
    reasons.push('Manual review was requested for this target.');
  }

  const requiresManualReview =
    input.forceManualReview === true ||
    !recipientKnown ||
    !typeAllowed(input.requestType, input.config) ||
    (input.requestType === 'trialsmith' && !input.config.trialsmithEnabled);

  const canPrepare = input.config.enabled;
  if (!canPrepare && reasons.length === 0) {
    reasons.push('Request workflow is not enabled.');
  }

  const approved =
    input.status === 'approved' ||
    input.status === 'queued' ||
    (!input.config.requireApproval && input.config.autoSend);

  if (
    input.config.requireApproval &&
    input.status &&
    input.status !== 'approved'
  ) {
    if (input.status !== 'queued') {
      reasons.push('Request has not been approved.');
    }
  }

  const sendingAccountConfigured = hasSendingAccount(
    input.email,
    input.nodeEnv,
  );
  if (!sendingAccountConfigured) {
    reasons.push(
      'A valid sending account is not configured for live delivery. Local console logging may still record the message.',
    );
  }

  const canSend =
    canPrepare &&
    !requiresManualReview &&
    recipientKnown &&
    approved &&
    (sendingAccountConfigured ||
      selectEmailProvider(input.email, input.nodeEnv) === 'console');

  // Console path is always available for local safe display; live send needs account.
  const canSendLocally =
    canPrepare && !requiresManualReview && recipientKnown && approved;

  return {
    canPrepare,
    canSend: canSend || canSendLocally,
    requiresManualReview,
    reasons: [...new Set(reasons)],
  };
}

export function typeAllowed(
  type: EwiRequestType,
  config: EwiRequestWorkflowSettings,
): boolean {
  switch (type) {
    case 'foia':
      return config.allowFoia;
    case 'university_file':
      return config.allowUniversityFile;
    case 'graduation_announcement':
      return config.allowGraduationAnnouncement;
    case 'university_employment':
      return config.allowUniversityEmployment;
    case 'follow_up':
      return config.allowFollowUp;
    case 'trialsmith':
      return config.trialsmithEnabled;
    default:
      return false;
  }
}

export function hasSendingAccount(
  email: EmailSettings,
  nodeEnv?: string,
): boolean {
  if (!email.deliveryEnabled) return false;
  const kind = selectEmailProvider(email, nodeEnv);
  if (kind === 'console') return false;
  if (kind === 'smtp') {
    return Boolean(email.host.trim()) && isConfirmedSender(email.from);
  }
  return false;
}

export function isValidRecipientEmail(
  value: string | null | undefined,
): boolean {
  return EMAIL_PATTERN.test(value?.trim() ?? '');
}
