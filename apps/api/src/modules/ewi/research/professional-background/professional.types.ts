/**
 * Normalized professional, financial, and background records.
 * Values come only from collected source statements. Nothing is invented.
 */

export const PROFESSIONAL_KINDS = [
  'grant',
  'grant_result',
  'patent',
  'trademark',
  'award',
  'military_claim',
  'military_medal',
  'membership',
  'professional_organization',
  'corporate_affiliation',
  'open_payments',
  'forensic_income',
  'other_public_income',
] as const;

export type ProfessionalKind = (typeof PROFESSIONAL_KINDS)[number];

/** Attribute keys that may be stored for restricted professional sources. */
export const PROFESSIONAL_METADATA_KEYS = [
  'professionalKind',
  'name',
  'title',
  'identifier',
  'grantId',
  'patentNumber',
  'trademarkNumber',
  'filingDate',
  'startDate',
  'endDate',
  'dates',
  'status',
  'role',
  'participation',
  'authorship',
  'institution',
  'organization',
  'source',
  'resultUrl',
  'resultsAvailable',
  'resultsUnavailableReason',
  'cvClaim',
  'publicRecord',
  'paymentDate',
  'paymentAmount',
  'payer',
  'natureOfPayment',
  'forensicWork',
  'defenseWork',
  'hourlyRate',
  'referralInfo',
  'percentForensicWork',
  'percentDefenseWork',
  'evidenceReference',
  'evidenceReferences',
  'shortDescription',
  'neutralSummary',
  'verificationNote',
  'publishedAt',
  'publicationDate',
  'date',
  'metadataOnly',
  'identity',
] as const;

export interface ProfessionalRecord {
  id: string;
  kind: ProfessionalKind;
  title: string;
  name: string | null;
  identifier: string | null;
  filingDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  role: string | null;
  participation: string | null;
  authorship: string | null;
  institution: string | null;
  organization: string | null;
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
  resultUrl: string | null;
  resultsAvailable: boolean | null;
  resultsUnavailableReason: string | null;
  cvClaim: string | null;
  publicRecord: string | null;
  paymentDate: string | null;
  paymentAmount: string | null;
  payer: string | null;
  natureOfPayment: string | null;
  forensicWork: string | null;
  defenseWork: string | null;
  hourlyRate: string | null;
  referralInfo: string | null;
  percentForensicWork: string | null;
  percentDefenseWork: string | null;
  summary: string | null;
  verificationNote: string | null;
  evidenceReferences: string[];
  restricted: boolean;
  identityMatch: 'matched' | 'uncertain' | undefined;
  sortDate: string | null;
}

export interface ProfessionalSourceAttempt {
  sourceId: string;
  status: string;
  outcome?: string;
  access?: string;
  message?: string;
  itemCount: number;
}

export interface ProfessionalBackgroundDossier {
  grants: ProfessionalRecord[];
  patentsAndTrademarks: ProfessionalRecord[];
  awardsAndMedals: ProfessionalRecord[];
  militaryClaims: ProfessionalRecord[];
  memberships: ProfessionalRecord[];
  organizations: ProfessionalRecord[];
  corporateAffiliations: ProfessionalRecord[];
  financial: ProfessionalRecord[];
  records: ProfessionalRecord[];
  sourceAttempts: ProfessionalSourceAttempt[];
}
