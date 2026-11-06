/**
 * Per-claim professional membership assessments against official directories.
 * Membership stays distinct from board certification, employment, and education.
 */

export type MembershipVerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'self_reported'
  | 'not_independently_verified'
  | 'unable_to_access'
  | 'no_matching_record'
  | 'insufficient_information';

export const MEMBERSHIP_STATUS_LABEL: Record<
  MembershipVerificationStatus,
  string
> = {
  verified: 'Verified',
  partially_verified: 'Partially Verified',
  self_reported: 'Self-Reported',
  not_independently_verified: 'Not Independently Verified',
  unable_to_access: 'Unable to Access',
  no_matching_record: 'No Matching Record Found',
  insufficient_information: 'Insufficient Information',
};

export type MembershipType =
  | 'member'
  | 'fellow'
  | 'committee'
  | 'affiliate'
  | 'other'
  | 'unknown';

export type MembershipOrgAccess =
  | 'public_directory'
  | 'login_required'
  | 'unknown';

/** One membership row taken from the CV (no invented fields). */
export interface MembershipEntry {
  id: string;
  organization: string | null;
  membershipType: MembershipType;
  statusText: string | null;
  startYear: number | null;
  endYear: number | null;
  designation: string | null;
  statement: string;
  quote: string;
  page: number | null;
  cvSourceUrl: string | null;
  claimId: string | null;
}

export interface MembershipSourceHit {
  url: string;
  title: string | null;
  excerpt: string;
  retrievedAt: string;
  host: string;
  /** Identity strength of the directory hit relative to the subject. */
  identityLevel: 'strong' | 'possible' | 'weak' | 'none';
}

/** Result of checking one membership claim against official sources. */
export interface MembershipAssessment {
  id: string;
  entry: MembershipEntry;
  status: MembershipVerificationStatus;
  organizationCanonical: string | null;
  officialWebsite: string | null;
  directoryUrl: string | null;
  access: MembershipOrgAccess | null;
  evidence: MembershipSourceHit | null;
  queriesRun: string[];
  explanation: string;
  limitations: string[];
  retrievedAt: string;
}

export interface MembershipDossier {
  assessedAt: string;
  assessments: MembershipAssessment[];
  warnings: string[];
}
