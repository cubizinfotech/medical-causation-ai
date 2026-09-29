import type { EwiRequestWorkflowSettings } from './config.types';

/**
 * Configurable EWI request/email workflow.
 * Does not hardcode recipient emails or credentials.
 */
export const ewiRequestConfig = (): EwiRequestWorkflowSettings => ({
  enabled: process.env.EWI_REQUEST_WORKFLOW_ENABLED === 'true',
  autoSend: process.env.EWI_REQUEST_AUTO_SEND === 'true',
  requireApproval: process.env.EWI_REQUEST_REQUIRE_APPROVAL !== 'false',
  followUpDays: readInt(process.env.EWI_REQUEST_FOLLOW_UP_DAYS, 14, 1, 90),
  trialsmithEnabled: process.env.EWI_REQUEST_TRIALSMITH_ENABLED === 'true',
  senderName: process.env.EWI_REQUEST_SENDER_NAME?.trim() || 'Records Counsel',
  allowFoia: process.env.EWI_REQUEST_ALLOW_FOIA !== 'false',
  allowUniversityFile: process.env.EWI_REQUEST_ALLOW_UNIVERSITY !== 'false',
  allowGraduationAnnouncement:
    process.env.EWI_REQUEST_ALLOW_GRADUATION !== 'false',
  allowUniversityEmployment:
    process.env.EWI_REQUEST_ALLOW_UNIVERSITY_EMPLOYMENT !== 'false',
  allowFollowUp: process.env.EWI_REQUEST_ALLOW_FOLLOW_UP !== 'false',
});

function readInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
