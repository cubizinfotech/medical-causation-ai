/**
 * Per-claim board certification assessments against the correct issuing board.
 * Distinct from professional memberships, licenses, and degrees.
 */

export type BoardCertificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'self_reported'
  | 'not_independently_verified'
  | 'no_matching_record'
  | 'unable_to_access'
  | 'potential_match_unconfirmed'
  | 'insufficient_information'
  | 'not_checked';

export const BOARD_CERTIFICATION_STATUS_LABEL: Record<
  BoardCertificationStatus,
  string
> = {
  verified: 'Verified',
  partially_verified: 'Partially Verified',
  self_reported: 'Self-Reported',
  not_independently_verified: 'Not Independently Verified',
  no_matching_record: 'No Matching Record',
  unable_to_access: 'Unable to Access',
  potential_match_unconfirmed: 'Potential Match – Identity Unconfirmed',
  insufficient_information: 'Insufficient Information',
  not_checked: 'Not Checked',
};

export type BoardAccess = 'public_directory' | 'login_required' | 'unknown';

export type BoardSearchMethod = 'site_serp' | 'none';

/** One board-certification row taken from the CV (no invented fields). */
export interface BoardCertificationEntry {
  id: string;
  /** Credential / specialty name as stated. */
  credentialName: string | null;
  /** Certifying organization as stated (may be unresolved). */
  boardName: string | null;
  /** Registry id when resolved; null when unknown. */
  boardId: string | null;
  specialty: string | null;
  certificationDate: string | null;
  expirationOrStatus: string | null;
  certificationNumber: string | null;
  statement: string;
  quote: string;
  page: number | null;
  cvSourceUrl: string | null;
  claimId: string | null;
  /** Heuristic confidence that this line is a board certification. */
  extractionConfidence: 'high' | 'medium' | 'low';
}

export interface BoardCertificationSourceHit {
  url: string;
  title: string | null;
  excerpt: string;
  retrievedAt: string;
  host: string;
  identityLevel: 'strong' | 'possible' | 'weak' | 'none';
  searchResultOnly: boolean;
}

export interface BoardCertificationAssessment {
  id: string;
  entry: BoardCertificationEntry;
  status: BoardCertificationStatus;
  boardCanonical: string | null;
  officialWebsite: string | null;
  verificationUrl: string | null;
  access: BoardAccess | null;
  evidence: BoardCertificationSourceHit | null;
  queriesRun: string[];
  explanation: string;
  limitations: string[];
  retrievedAt: string;
}

export interface BoardCertificationDossier {
  assessedAt: string;
  assessments: BoardCertificationAssessment[];
  warnings: string[];
}
