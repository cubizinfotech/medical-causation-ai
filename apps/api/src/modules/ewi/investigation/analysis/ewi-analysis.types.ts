export const EWI_ANALYSIS_SCHEMA_VERSION = '1.0' as const;

export const EWI_ASSESSMENTS = [
  'verified',
  'partially_verified',
  'conflicting',
  'unverified',
  'not_found',
  'restricted_unavailable',
] as const;

export type EwiAssessment = (typeof EWI_ASSESSMENTS)[number];

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
}

export interface EwiAnalysisDocument {
  schemaVersion: typeof EWI_ANALYSIS_SCHEMA_VERSION;
  groups: Array<{ category: string; findingKeys: string[] }>;
  duplicates: Array<{ findingKeys: string[]; reason: string }>;
  comparisons: Array<{ findingKeys: string[]; note: string }>;
  conflicts: Array<{ findingKeys: string[]; description: string }>;
  missing: Array<{
    category: string;
    assessment: 'not_found' | 'restricted_unavailable';
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
  summary: string;
  conclusions: EwiAnalysisConclusion[];
  questions: EwiAnalysisQuestion[];
}

export interface EwiAnalysisRecord {
  origin: 'ai' | 'deterministic';
  providerName: string | null;
  document: EwiAnalysisDocument;
}
