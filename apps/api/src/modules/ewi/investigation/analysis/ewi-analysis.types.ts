export const EWI_ANALYSIS_SCHEMA_VERSION = '1.1' as const;

/**
 * Evidence status labels for analysis output.
 * Labels are derived from the collected packet. The model cannot upgrade them.
 */
export const EWI_ASSESSMENTS = [
  'verified',
  'partially_verified',
  'conflicting',
  'not_verified',
  'not_found',
  'unavailable',
  'restricted',
] as const;

export type EwiAssessment = (typeof EWI_ASSESSMENTS)[number];

export const EWI_ANALYSIS_SECTIONS = [
  'expert_summary',
  'credentials',
  'cv_comparison',
  'inconsistencies',
  'legal_matters',
  'orders',
  'motions',
  'depositions',
  'contradictory_testimony',
  'publications',
  'authorship',
  'grants_patents',
  'licenses_certifications',
  'memberships',
  'websites',
  'videos',
  'social_media',
  'income_bias',
  'university_rules',
  'missing_unverified',
  'investigation_findings',
] as const;

export type EwiAnalysisSectionId = (typeof EWI_ANALYSIS_SECTIONS)[number];

export interface AnalysisFinding {
  findingKey: string;
  category: string;
  title: string;
  summary: string;
  url?: string;
  providerId: string;
  informationStatus: string;
  access: string;
  raw?: Record<string, unknown>;
}

export interface AnalysisSourceAttempt {
  sourceRef: string;
  providerId: string;
  category: string;
  status: string;
  access: string;
  message?: string;
  itemCount: number;
}

export interface AnalysisPacket {
  expertName: string;
  specialty: string;
  findings: AnalysisFinding[];
  sourceAttempts: AnalysisSourceAttempt[];
}

export interface EwiAnalysisConclusion {
  text: string;
  sourceRefs: string[];
}

export interface EwiAnalysisQuestion {
  category: string;
  question: string;
  sourceRefs: string[];
  /** When evidence is weak or unavailable, reflect that uncertainty. */
  uncertaintyNote?: string;
}

export interface EwiAnalysisSectionSummary {
  section: EwiAnalysisSectionId;
  text: string;
  status: EwiAssessment;
  sourceRefs: string[];
  findingKeys: string[];
}

export interface EwiAnalysisFindingNote {
  text: string;
  status: EwiAssessment;
  sourceRefs: string[];
}

export interface EwiAnalysisDocument {
  schemaVersion: typeof EWI_ANALYSIS_SCHEMA_VERSION;
  groups: Array<{ category: string; findingKeys: string[] }>;
  duplicates: Array<{ findingKeys: string[]; reason: string }>;
  comparisons: Array<{ findingKeys: string[]; note: string }>;
  conflicts: Array<{ findingKeys: string[]; description: string }>;
  missing: Array<{
    category: string;
    assessment: 'not_found' | 'unavailable' | 'restricted';
    note: string;
    sourceRefs: string[];
  }>;
  cvDiscrepancies: Array<{ findingKeys: string[]; description: string }>;
  assessments: Array<{
    findingKey: string;
    category: string;
    assessment: EwiAssessment;
    statement: string;
    sourceRefs: string[];
  }>;
  sectionSummaries: EwiAnalysisSectionSummary[];
  investigationFindings: EwiAnalysisFindingNote[];
  summary: string;
  conclusions: EwiAnalysisConclusion[];
  questions: EwiAnalysisQuestion[];
}

export interface EwiAnalysisRecord {
  origin: 'ai' | 'deterministic';
  providerName: string | null;
  document: EwiAnalysisDocument;
}

/** Category filters used when building section summaries from the packet. */
export const SECTION_CATEGORY_MAP: Record<
  EwiAnalysisSectionId,
  readonly string[]
> = {
  expert_summary: ['identity', 'profile', 'specialty', 'location'],
  credentials: [
    'education',
    'license',
    'state_license',
    'board_certification',
    'certification_organization',
  ],
  cv_comparison: ['cv', 'profile'],
  inconsistencies: [],
  legal_matters: ['legal', 'legal_case'],
  orders: ['court_order', 'order'],
  motions: ['motion'],
  depositions: ['deposition'],
  contradictory_testimony: ['testimony', 'expert_testimony'],
  publications: ['publication'],
  authorship: ['publication'],
  grants_patents: ['grant', 'patent', 'trademark'],
  licenses_certifications: [
    'license',
    'state_license',
    'board_certification',
    'certification_organization',
  ],
  memberships: ['membership'],
  websites: ['website', 'advertising', 'ime', 'directory', 'office'],
  videos: ['video', 'presentation', 'powerpoint'],
  social_media: ['social'],
  income_bias: ['income_bias', 'corporate_affiliation', 'patient_review'],
  university_rules: ['university', 'university_rules'],
  missing_unverified: [],
  investigation_findings: [],
};

export const MIN_LEADING_QUESTIONS = 100;
