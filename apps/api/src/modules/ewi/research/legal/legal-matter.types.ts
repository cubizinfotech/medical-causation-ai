/**
 * Normalized legal research records.
 * Values come only from collected source statements. Nothing is invented.
 */
import type { ExpertChallenge } from './expert-challenge';

export const LEGAL_DOCUMENT_TYPES = [
  'case',
  'malpractice',
  'expert_witness_case',
  'motion',
  'order',
  'pleading',
  'deposition',
  'testimony',
  'criminal_record',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const ORDER_SIGNIFICANCE_TAGS = [
  'limits_expert',
  'strikes_expert',
  'criticizes_expert',
  'restricts_testimony',
  'credibility',
  'qualifications',
  'sanctions',
  'material_effect',
] as const;

export type OrderSignificanceTag = (typeof ORDER_SIGNIFICANCE_TAGS)[number];

/** Attribute keys that may be stored for restricted legal sources. Body and PDF keys are never stored. */
export const LEGAL_METADATA_KEYS = [
  'documentType',
  'caseName',
  'caseNumber',
  'court',
  'jurisdiction',
  'filingDate',
  'documentDate',
  'date',
  'relevance',
  'findingsRegardingExpert',
  'evidenceReference',
  'matterKind',
  'orderTags',
  'shortDescription',
  'transcriptMetadata',
  'importantStatements',
  'publishedAt',
  'publicationDate',
  'metadataOnly',
  'identity',
  'citation',
  'challenge',
] as const;

export interface LegalMatter {
  id: string;
  documentType: LegalDocumentType;
  caseName: string | null;
  caseNumber: string | null;
  court: string | null;
  jurisdiction: string | null;
  filingDate: string | null;
  documentDate: string | null;
  sourceUrl: string | null;
  sourceId: string;
  sourceName: string;
  relevance: string | null;
  summary: string | null;
  findingsRegardingExpert: string | null;
  evidenceReference: string;
  title: string;
  restricted: boolean;
  identityMatch: 'matched' | 'uncertain' | undefined;
  orderTags: OrderSignificanceTag[];
  shortDescription: string | null;
  transcriptMetadata: string | null;
  importantStatements: string[];
  citation: string | null;
  /** Set when the opinion mentions an admissibility challenge. */
  challenge: ExpertChallenge | null;
}

/** An opinion that mentions the expert with Daubert/Frye/Rule 702 language. */
export interface ChallengeRecord {
  matter: LegalMatter;
  challenge: ExpertChallenge;
  sortDate: string | null;
}

export interface PrioritizedOrder {
  matter: LegalMatter;
  significanceScore: number;
  significanceTags: OrderSignificanceTag[];
  sortDate: string | null;
}

export interface ChronologicalFiling {
  matter: LegalMatter;
  sortDate: string | null;
  description: string;
}

export interface DepositionRecord {
  matter: LegalMatter;
  caseName: string | null;
  date: string | null;
  sourceLink: string | null;
  transcriptMetadata: string | null;
  summary: string | null;
  importantStatements: string[];
  contradictions: string[];
}

export interface TestimonyContradiction {
  id: string;
  statementA: string;
  statementB: string;
  sourceA: string;
  sourceB: string;
  evidenceReferences: string[];
  relatedUrls: string[];
  description: string;
}

export interface LegalSourceAttempt {
  sourceId: string;
  status: string;
  outcome?: string;
  access?: string;
  message?: string;
  itemCount: number;
}

export interface LegalResearchDossier {
  matters: LegalMatter[];
  orders: PrioritizedOrder[];
  motionsAndPleadings: ChronologicalFiling[];
  depositions: DepositionRecord[];
  testimonyContradictions: TestimonyContradiction[];
  /** Determined rulings first (excluded, limited, admitted), newest first. */
  challenges: ChallengeRecord[];
  sourceAttempts: LegalSourceAttempt[];
}
