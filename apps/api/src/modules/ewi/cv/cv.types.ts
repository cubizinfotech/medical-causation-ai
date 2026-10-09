import type { InconsistencyLabel } from '../research/verification-labels';

export const CV_CLAIM_CATEGORIES = [
  'specialty',
  'board_certification',
  'license',
  'education',
  'training',
  'appointment',
  'publications_count',
  'publication',
  'membership',
  'award',
  'expert_witness',
  'industry_relationship',
] as const;

export type CvClaimCategory = (typeof CV_CLAIM_CATEGORIES)[number];

/** Normalized fields a comparison can use; only what the CV states. */
export interface CvClaimDetails {
  state?: string;
  licenseNumber?: string;
  board?: string;
  specialty?: string;
  year?: string;
  status?: string;
  institution?: string;
  /** Appointment title or publication title. */
  title?: string;
  degree?: string;
  journal?: string;
  company?: string;
  role?: string;
  name?: string;
  /** Stated number of publications or expert cases. */
  count?: number;
  plaintiffPercent?: number;
  defensePercent?: number;
}

/** One statement the CV makes, quoted from its page. */
export interface CvClaim {
  id: string;
  category: CvClaimCategory;
  statement: string;
  details: CvClaimDetails;
  page: number;
  quote: string;
}

export interface CvDocumentInfo {
  id: string;
  name: string;
  pageCount: number;
  unreadablePages: number[];
  ocrPages: number[];
}

export interface CvExtraction {
  document: CvDocumentInfo;
  status: 'completed' | 'partial' | 'failed';
  claims: CvClaim[];
  warnings: string[];
}

export type CvComparisonTopic =
  | 'license'
  | 'specialty'
  | 'board_certification'
  | 'publications_count'
  | 'publication'
  | 'industry_relationship'
  | 'appointment'
  | 'expert_witness'
  | 'education';

/** A CV statement set against what a source shows. */
export interface CvComparison {
  id: string;
  topic: CvComparisonTopic;
  label: InconsistencyLabel;
  severity: 'high' | 'medium' | 'low';
  title: string;
  cv: {
    claimId?: string;
    statement: string;
    page?: number;
    quote?: string;
  } | null;
  source: { name: string; statement: string; url?: string } | null;
  note: string;
}

export interface CvCheck {
  document: CvDocumentInfo;
  status: 'completed' | 'partial' | 'failed';
  claims: CvClaim[];
  comparisons: CvComparison[];
  warnings: string[];
}
