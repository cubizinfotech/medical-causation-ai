/**
 * Per-directory expert-witness / IME advertising assessments.
 * Distinct from professional association memberships and own practice sites.
 */

export type DirectoryResearchStatus =
  | 'profile_found'
  | 'no_matching_public_profile'
  | 'unable_to_access'
  | 'search_not_supported'
  | 'potential_match_unconfirmed'
  | 'not_checked';

export const DIRECTORY_STATUS_LABEL: Record<DirectoryResearchStatus, string> = {
  profile_found: 'Profile Found',
  no_matching_public_profile: 'No Matching Public Profile Found',
  unable_to_access: 'Unable to Access',
  search_not_supported: 'Search Not Supported',
  potential_match_unconfirmed: 'Potential Match – Identity Unconfirmed',
  not_checked: 'Not Checked',
};

export type DirectoryType =
  | 'expert_witness_directory'
  | 'ime_referral'
  | 'other';

export type DirectorySearchMethod = 'site_serp' | 'none';

export type DirectoryAccess =
  | 'public_directory'
  | 'login_required'
  | 'unknown';

export interface DirectorySourceHit {
  url: string;
  title: string | null;
  excerpt: string;
  retrievedAt: string;
  host: string;
  identityLevel: 'strong' | 'possible' | 'weak' | 'none';
  /** True when only a SERP snippet was available (not a read profile page). */
  searchResultOnly: boolean;
}

/** Result of checking one registered advertising directory for the subject. */
export interface DirectoryAssessment {
  id: string;
  directoryId: string;
  directoryName: string;
  directoryType: DirectoryType;
  homeUrl: string;
  status: DirectoryResearchStatus;
  searchMethod: DirectorySearchMethod;
  access: DirectoryAccess;
  profileUrl: string | null;
  evidence: DirectorySourceHit | null;
  queriesRun: string[];
  explanation: string;
  limitations: string[];
  retrievedAt: string;
}

export interface DirectoryAdvertisingDossier {
  assessedAt: string;
  assessments: DirectoryAssessment[];
  warnings: string[];
}
