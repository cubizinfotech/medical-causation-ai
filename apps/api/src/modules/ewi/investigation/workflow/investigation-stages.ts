import {
  EXPERT_RESEARCH_CATALOG,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
} from '@integrations/expert-research';

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
    providers: ['web_search', 'cv_profile', 'orcid'],
  },
  {
    id: 'education',
    label: 'Verify education and degrees',
    kind: 'research',
    providers: ['education_verification', 'university_accreditation'],
  },
  {
    id: 'licenses',
    label: 'Verify medical licenses',
    kind: 'research',
    providers: ['state_license', 'state_discipline'],
  },
  {
    id: 'boards',
    label: 'Verify board certifications',
    kind: 'research',
    providers: ['board_certification', 'certification_organization'],
  },
  {
    id: 'publications',
    label: 'Research publications and authorship',
    kind: 'research',
    providers: [
      'pubmed',
      'author_verification',
      'lead_author_verification',
      'crossref',
      'openalex',
    ],
  },
  {
    id: 'grants',
    label: 'Research grants',
    kind: 'research',
    providers: ['grants', 'grant_results'],
  },
  {
    id: 'patents',
    label: 'Research patents',
    kind: 'research',
    providers: ['patents', 'trademarks'],
  },
  {
    id: 'awards',
    label: 'Research awards and medals',
    kind: 'research',
    providers: ['awards', 'military_claims'],
  },
  {
    id: 'legal',
    label: 'Research legal cases, motions, orders and available references',
    kind: 'research',
    providers: [
      'courtlistener',
      'motions',
      'orders',
      'pleadings',
      'depositions',
      'expert_testimony',
      'lexisnexis',
    ],
  },
  {
    id: 'directories',
    label: 'Research expert witness directories',
    kind: 'research',
    providers: [
      'expert_directory',
      'dri',
      'seak',
      'alm_law',
      'jurispro',
      'expertlaw',
      'expertpages',
      'expertwitness_com',
      'other_expert_directories',
    ],
  },
  {
    id: 'websites',
    label: 'Research expert websites and advertising',
    kind: 'research',
    providers: ['expert_website', 'advertising', 'google_maps'],
  },
  {
    id: 'ime',
    label: 'Research IME-related information',
    kind: 'research',
    providers: ['ime_websites', 'ime_advertising'],
  },
  {
    id: 'videos',
    label: 'Research YouTube/videos/presentations',
    kind: 'research',
    providers: ['youtube', 'presentations', 'powerpoints'],
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
    providers: ['news', 'blogs'],
  },
  {
    id: 'university-rules',
    label: 'Research university/professional rules',
    kind: 'research',
    providers: ['university'],
  },
  {
    id: 'public-records',
    label: 'Research reviews, payments, affiliations, and public records',
    kind: 'research',
    providers: [
      'patient_reviews',
      'open_payments',
      'corporate_affiliations',
      'criminal_records',
      'malpractice_records',
    ],
  },
  {
    id: 'cross-check',
    label: 'Cross-check information',
    kind: 'cross-check',
    providers: [],
  },
  {
    id: 'discrepancies',
    label: 'Identify inconsistencies',
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

/** The investigation plan is the stage list. Every catalog provider is included once. */
export function createResearchPlan(
  _query: ExpertResearchQuery,
): readonly InvestigationStageDefinition[] {
  return EWI_WORKFLOW_STAGES;
}

export function researchPlanProviderIds(
  stages: readonly InvestigationStageDefinition[] = EWI_WORKFLOW_STAGES,
): ExpertResearchProviderId[] {
  return stages.flatMap((stage) => [...stage.providers]);
}

export function assertResearchPlanCoversCatalog(
  stages: readonly InvestigationStageDefinition[] = EWI_WORKFLOW_STAGES,
): void {
  const planned = researchPlanProviderIds(stages);
  const catalog = EXPERT_RESEARCH_CATALOG.map((provider) => provider.id);
  const missing = catalog.filter((id) => !planned.includes(id));
  const extra = planned.filter((id) => !catalog.includes(id));
  const duplicates = planned.filter(
    (id, index) => planned.indexOf(id) !== index,
  );
  if (missing.length || extra.length || duplicates.length) {
    throw new Error(
      `Research plan does not match the provider catalog. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}. Duplicates: ${duplicates.join(', ') || 'none'}.`,
    );
  }
}
