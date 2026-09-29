import { renderPromptTemplate } from '@ai/utils/prompt-template.util';

export const EWI_EMAIL_TEMPLATE_IDS = [
  'foia-request',
  'university-record-request',
  'graduation-announcement',
  'university-employment-request',
  'follow-up-request',
  'trialsmith-outreach',
  'research-request',
] as const;

export type EwiEmailTemplateId = (typeof EWI_EMAIL_TEMPLATE_IDS)[number];

export interface EwiEmailTemplate {
  id: `ewi/${EwiEmailTemplateId}`;
  subject: string;
  text: string;
  html: string;
  required: readonly string[];
}

const SHARED_REQUIRED = [
  'recipientName',
  'organizationName',
  'expertName',
  'caseReference',
  'senderName',
] as const;

export const EWI_EMAIL_TEMPLATES: Record<EwiEmailTemplateId, EwiEmailTemplate> =
  {
    'foia-request': {
      id: 'ewi/foia-request',
      required: [...SHARED_REQUIRED, 'requestDescription'],
      subject: 'Public records request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'This is a request for discoverable public records from {{organizationName}} concerning {{expertName}}.',
        '',
        '{{requestDescription}}',
        '',
        'Please reply with the records that can be released, or with the reason a record cannot be released. Please also advise of any applicable fees or charges. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>This is a request for discoverable public records from {{organizationName}} concerning {{expertName}}.</p>',
        '<p>{{requestDescription}}</p>',
        '<p>Please reply with the records that can be released, or with the reason a record cannot be released. Please also advise of any applicable fees or charges. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'university-record-request': {
      id: 'ewi/university-record-request',
      required: [...SHARED_REQUIRED, 'recordType', 'dateRange'],
      subject: 'Education record request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'We are requesting records from {{organizationName}} concerning {{expertName}}.',
        '',
        'Record type: {{recordType}}',
        'Dates: {{dateRange}}',
        '',
        'Please confirm whether these records exist, how a copy can be requested, and any applicable fees or charges. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>We are requesting records from {{organizationName}} concerning {{expertName}}.</p>',
        '<p>Record type: {{recordType}}<br>Dates: {{dateRange}}</p>',
        '<p>Please confirm whether these records exist, how a copy can be requested, and any applicable fees or charges. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'graduation-announcement': {
      id: 'ewi/graduation-announcement',
      required: [...SHARED_REQUIRED, 'claimedDegree', 'claimedYear'],
      subject: 'Graduation announcement request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'Please provide any publicly available graduation announcement for the following credential associated with {{expertName}} at {{organizationName}}.',
        '',
        'Degree: {{claimedDegree}}',
        'Year: {{claimedYear}}',
        '',
        'Please advise of any applicable fees or charges. If the institution cannot locate an announcement, please say so. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>Please provide any publicly available graduation announcement for the following credential associated with {{expertName}} at {{organizationName}}.</p>',
        '<p>Degree: {{claimedDegree}}<br>Year: {{claimedYear}}</p>',
        '<p>Please advise of any applicable fees or charges. If the institution cannot locate an announcement, please say so. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'university-employment-request': {
      id: 'ewi/university-employment-request',
      required: [...SHARED_REQUIRED, 'employmentRole', 'activityDescription'],
      subject:
        'University employment/activity request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'Where appropriate and permitted, we request employment or activity information from {{organizationName}} concerning {{expertName}}.',
        '',
        'Role or title: {{employmentRole}}',
        'Activity: {{activityDescription}}',
        '',
        'Please reply with information you are authorized to release and advise of any applicable fees or charges. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>Where appropriate and permitted, we request employment or activity information from {{organizationName}} concerning {{expertName}}.</p>',
        '<p>Role or title: {{employmentRole}}<br>Activity: {{activityDescription}}</p>',
        '<p>Please reply with information you are authorized to release and advise of any applicable fees or charges. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'follow-up-request': {
      id: 'ewi/follow-up-request',
      required: [...SHARED_REQUIRED, 'originalSubject', 'originalSentDate'],
      subject: 'Follow-up: {{originalSubject}}',
      text: [
        '{{recipientName}},',
        '',
        'This is a follow-up to our earlier request to {{organizationName}} concerning {{expertName}}.',
        '',
        'Original subject: {{originalSubject}}',
        'Original request date: {{originalSentDate}}',
        'Case reference: {{caseReference}}',
        '',
        'Please advise on the status of that request, including any applicable fees still outstanding.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>This is a follow-up to our earlier request to {{organizationName}} concerning {{expertName}}.</p>',
        '<p>Original subject: {{originalSubject}}<br>Original request date: {{originalSentDate}}<br>Case reference: {{caseReference}}</p>',
        '<p>Please advise on the status of that request, including any applicable fees still outstanding.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'trialsmith-outreach': {
      id: 'ewi/trialsmith-outreach',
      required: [...SHARED_REQUIRED, 'requestPurpose'],
      subject: 'Configured outreach regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'This outreach to {{organizationName}} concerning {{expertName}} is sent only because the client configured and authorized TrialSmith outreach for this matter.',
        '',
        '{{requestPurpose}}',
        '',
        'Please reply with any information you are authorized to release. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>This outreach to {{organizationName}} concerning {{expertName}} is sent only because the client configured and authorized TrialSmith outreach for this matter.</p>',
        '<p>{{requestPurpose}}</p>',
        '<p>Please reply with any information you are authorized to release. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'research-request': {
      id: 'ewi/research-request',
      required: [...SHARED_REQUIRED, 'requestPurpose'],
      subject: 'Research request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'This is a client-approved request to {{organizationName}} concerning {{expertName}}.',
        '',
        '{{requestPurpose}}',
        '',
        'Please reply with any information you are authorized to release. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>This is a client-approved request to {{organizationName}} concerning {{expertName}}.</p>',
        '<p>{{requestPurpose}}</p>',
        '<p>Please reply with any information you are authorized to release. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
  };

/** Legacy id kept for callers that still pass the previous graduation template name. */
export function resolveEwiEmailTemplateId(
  kind: string,
): EwiEmailTemplateId | null {
  if (kind === 'graduation-verification') return 'graduation-announcement';
  if ((EWI_EMAIL_TEMPLATE_IDS as readonly string[]).includes(kind)) {
    return kind as EwiEmailTemplateId;
  }
  return null;
}

export function renderEwiEmailTemplate(
  template: EwiEmailTemplate,
  variables: Record<string, string>,
): { subject: string; text: string; html: string } {
  const htmlVariables = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]),
  );
  return {
    subject: renderPromptTemplate(template.subject, variables)
      .replace(/\s+/g, ' ')
      .trim(),
    text: renderPromptTemplate(template.text, variables),
    html: renderPromptTemplate(template.html, htmlVariables),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
