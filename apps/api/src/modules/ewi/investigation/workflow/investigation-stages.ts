import type { ExpertResearchProviderId } from '@integrations/expert-research';

export const EWI_STAGE_IDENTIFY = 'identify-expert';
export const EWI_STAGE_REPORT = 'report';

export interface InvestigationStageDefinition {
  id: string;
  label: string;
  kind:
    | 'identify'
    | 'research'
    | 'cross-check'
    | 'discrepancy'
    | 'summary'
    | 'questions'
    | 'report';
  /** Providers consulted for a research stage. Empty means no source is connected. */
  providers: readonly ExpertResearchProviderId[];
}

export const EWI_WORKFLOW_STAGES: readonly InvestigationStageDefinition[] = [
  {
    id: EWI_STAGE_IDENTIFY,
    label: 'Identify Expert',
    kind: 'identify',
    providers: [],
  },
  {
    id: 'profiles',
    label: 'Find CV and professional profiles',
    kind: 'research',
    providers: ['web_search', 'orcid'],
  },
  {
    id: 'education',
    label: 'Verify education and degrees',
    kind: 'research',
    providers: ['university'],
  },
  {
    id: 'licenses',
    label: 'Verify medical licenses',
    kind: 'research',
    providers: ['state_license'],
  },
  {
    id: 'boards',
    label: 'Verify board certifications',
    kind: 'research',
    providers: [],
  },
  {
    id: 'publications',
    label: 'Research publications and authorship',
    kind: 'research',
    providers: ['pubmed', 'author_verification', 'crossref', 'openalex'],
  },
  {
    id: 'grants',
    label: 'Research grants',
    kind: 'research',
    providers: ['grants'],
  },
  {
    id: 'patents',
    label: 'Research patents',
    kind: 'research',
    providers: ['patents'],
  },
  {
    id: 'awards',
    label: 'Research awards and medals',
    kind: 'research',
    providers: [],
  },
  {
    id: 'legal',
    label: 'Research legal cases, motions, orders and available references',
    kind: 'research',
    providers: ['courtlistener', 'lexisnexis'],
  },
  {
    id: 'directories',
    label: 'Research expert witness directories',
    kind: 'research',
    providers: ['expert_directory'],
  },
  {
    id: 'websites',
    label: 'Research expert websites and advertising',
    kind: 'research',
    providers: ['expert_website'],
  },
  {
    id: 'ime',
    label: 'Research IME-related information',
    kind: 'research',
    providers: ['ime_advertising'],
  },
  {
    id: 'videos',
    label: 'Research YouTube/videos/presentations',
    kind: 'research',
    providers: ['youtube'],
  },
  {
    id: 'social',
    label: 'Research public social media',
    kind: 'research',
    providers: ['social'],
  },
  {
    id: 'news',
    label: 'Research news and blogs',
    kind: 'research',
    providers: ['news'],
  },
  {
    id: 'university-rules',
    label: 'Research university/professional rules',
    kind: 'research',
    providers: ['university'],
  },
  {
    id: 'cross-check',
    label: 'Cross-check information',
    kind: 'cross-check',
    providers: [],
  },
  {
    id: 'discrepancies',
    label: 'Identify discrepancies',
    kind: 'discrepancy',
    providers: [],
  },
  {
    id: 'summary',
    label: 'Generate investigation summary',
    kind: 'summary',
    providers: [],
  },
  {
    id: 'questions',
    label: 'Generate cross-examination questions',
    kind: 'questions',
    providers: [],
  },
  {
    id: EWI_STAGE_REPORT,
    label: 'Generate final report',
    kind: 'report',
    providers: [],
  },
];

export const EWI_JOB_STEP_LABELS: Record<string, string> = Object.fromEntries(
  EWI_WORKFLOW_STAGES.map((stage) => [stage.id, stage.label]),
);

export type EwiWorkflowStageId = (typeof EWI_WORKFLOW_STAGES)[number]['id'];
