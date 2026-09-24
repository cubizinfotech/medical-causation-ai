import { renderPromptTemplate } from '@ai/utils/prompt-template.util';

export const EWI_EMAIL_TEMPLATE_IDS = [
  'foia-request',
  'university-record-request',
  'graduation-verification',
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
        'This is a request for public records from {{organizationName}} concerning {{expertName}}.',
        '',
        '{{requestDescription}}',
        '',
        'Please reply with the records that can be released, or with the reason a record cannot be released. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>This is a request for public records from {{organizationName}} concerning {{expertName}}.</p>',
        '<p>{{requestDescription}}</p>',
        '<p>Please reply with the records that can be released, or with the reason a record cannot be released. Reference {{caseReference}}.</p>',
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
        'Please confirm whether these records exist and how a copy can be requested. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>We are requesting records from {{organizationName}} concerning {{expertName}}.</p>',
        '<p>Record type: {{recordType}}<br>Dates: {{dateRange}}</p>',
        '<p>Please confirm whether these records exist and how a copy can be requested. Reference {{caseReference}}.</p>',
        '<p>{{senderName}}</p>',
      ].join('\n'),
    },
    'graduation-verification': {
      id: 'ewi/graduation-verification',
      required: [...SHARED_REQUIRED, 'claimedDegree', 'claimedYear'],
      subject: 'Degree verification request regarding {{expertName}}',
      text: [
        '{{recipientName}},',
        '',
        'Please verify whether {{organizationName}} awarded the following credential to {{expertName}}.',
        '',
        'Degree: {{claimedDegree}}',
        'Year: {{claimedYear}}',
        '',
        'If the institution cannot confirm this credential, please say so. Reference {{caseReference}}.',
        '',
        '{{senderName}}',
      ].join('\n'),
      html: [
        '<p>{{recipientName}},</p>',
        '<p>Please verify whether {{organizationName}} awarded the following credential to {{expertName}}.</p>',
        '<p>Degree: {{claimedDegree}}<br>Year: {{claimedYear}}</p>',
        '<p>If the institution cannot confirm this credential, please say so. Reference {{caseReference}}.</p>',
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
