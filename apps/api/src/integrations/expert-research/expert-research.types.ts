/**
 * Expert research provider contracts.
 * EWI calls ExpertResearchService. Providers do not get called from product business logic.
 */

export type ExpertResearchProviderId =
  | 'npi_registry'
  | 'web_search'
  | 'cv_profile'
  | 'education_verification'
  | 'university_accreditation'
  | 'state_license'
  | 'state_discipline'
  | 'board_certification'
  | 'certification_organization'
  | 'pubmed'
  | 'author_verification'
  | 'lead_author_verification'
  | 'crossref'
  | 'openalex'
  | 'orcid'
  | 'grants'
  | 'grant_results'
  | 'patents'
  | 'trademarks'
  | 'awards'
  | 'military_claims'
  | 'memberships'
  | 'professional_organizations'
  | 'courtlistener'
  | 'justia'
  | 'state_court_records'
  | 'motions'
  | 'orders'
  | 'pleadings'
  | 'depositions'
  | 'expert_testimony'
  | 'lexisnexis'
  | 'expert_directory'
  | 'dri'
  | 'seak'
  | 'alm_law'
  | 'jurispro'
  | 'expertlaw'
  | 'expertpages'
  | 'expertwitness_com'
  | 'other_expert_directories'
  | 'expert_website'
  | 'ime_websites'
  | 'advertising'
  | 'other_public_websites'
  | 'ime_advertising'
  | 'youtube'
  | 'presentations'
  | 'powerpoints'
  | 'social'
  | 'news'
  | 'blogs'
  | 'university'
  | 'google_maps'
  | 'patient_reviews'
  | 'open_payments'
  | 'corporate_affiliations'
  | 'criminal_records'
  | 'constitutional_sheriff'
  | 'post_records'
  | 'oath_keepers'
  | 'malpractice_records';

/** How the source may be accessed. Restricted sources are never scraped. */
export type SourceAccessClass = 'public' | 'restricted' | 'unavailable';

/**
 * What the collected item supports.
 * verified — the source statement supports the fact.
 * unverified — a fixture or an unconfirmed statement.
 * conflicting — two collected statements disagree.
 * unavailable — nothing was retrieved. This is not evidence of absence.
 */
export type InformationStatus =
  'verified' | 'unverified' | 'conflicting' | 'unavailable';

/**
 * Normalized provider outcome.
 * no_result means the source was consulted and returned nothing.
 * That is not evidence that a qualification is absent.
 */
export type ResearchOutcome =
  | 'success'
  | 'no_result'
  | 'unavailable'
  | 'restricted'
  | 'authentication_required'
  | 'rate_limited'
  | 'timeout'
  | 'api_failure'
  | 'conflicting';

/** Same name alone is not a match. Uncertain items are not merged. */
export type IdentityMatch = 'matched' | 'uncertain';

export type ProviderRequirement =
  | 'free_api'
  | 'paid_api'
  | 'account'
  | 'subscription'
  | 'manual'
  | 'user_credentials';

export type ResearchRunMode = 'mock' | 'live';

export interface ExpertResearchQuery {
  expertName: string;
  city: string;
  specialty: string;
  /** National Provider Identifier supplied by the attorney (10 digits). */
  npi?: string;
}

/**
 * How the expert was identified in the NPI Registry.
 * confirmed — one NPI record fits (or the supplied NPI fits the name).
 * ambiguous — several records could fit, or one fits only partly.
 * not_found — no record fits. That is not evidence the expert is unlicensed.
 * npi_mismatch — the supplied NPI belongs to someone else.
 * unavailable — the registry could not be checked.
 */
export type IdentityResolutionStatus =
  'confirmed' | 'ambiguous' | 'not_found' | 'npi_mismatch' | 'unavailable';

export interface ExpertIdentityCandidate {
  npi: string;
  name: string;
  credential: string | null;
  taxonomy: string | null;
  city: string | null;
  state: string | null;
  url: string;
}

export interface ExpertIdentityResolution {
  status: IdentityResolutionStatus;
  /** The confirmed record. Null unless status is confirmed. */
  identity: ExpertIdentityCandidate | null;
  /** What agreed, e.g. "NPI supplied", "name", "practice city", "specialty". */
  basis: string[];
  /** Plain-language explanation for the attorney. */
  note: string;
  /** Differences worth checking, e.g. a practice city that differs. */
  notes: string[];
  /** Possible records when the identity was not confirmed. */
  candidates: ExpertIdentityCandidate[];
  /** True for development fixtures. */
  simulated?: boolean;
}

export interface SourceMetadata {
  providerId: ExpertResearchProviderId;
  name: string;
  url?: string;
  retrievedAt: string;
  access: SourceAccessClass;
}

export interface ExpertEvidenceItem {
  sourceId: string;
  category: string;
  title: string;
  summary: string;
  url?: string;
  raw?: Record<string, unknown>;
  simulated?: boolean;
  access?: SourceAccessClass;
  informationStatus?: InformationStatus;
  identityMatch?: IdentityMatch;
  retrievedAt?: string;
  source?: SourceMetadata;
}

export interface ExpertResearchSourceResult {
  sourceId: ExpertResearchProviderId;
  status: 'ok' | 'skipped' | 'error' | 'unavailable' | 'no_result';
  outcome: ResearchOutcome;
  access: SourceAccessClass;
  message?: string;
  retrievedAt: string;
  items: ExpertEvidenceItem[];
  /** Set by the NPI Registry source. */
  identity?: ExpertIdentityResolution;
}

export interface ProviderDefinition {
  id: ExpertResearchProviderId;
  name: string;
  category: string;
  /** Access class of the upstream source. */
  accessClass: SourceAccessClass;
  requirement: ProviderRequirement;
  /** Env var for a future credential. Empty means no key is required. */
  credentialEnv?: string;
  /** True when RESEARCH_PROVIDER=live calls the real source. */
  liveImplemented: boolean;
  summary: string;
}

export interface IExpertResearchProvider {
  readonly id: ExpertResearchProviderId;
  readonly definition: ProviderDefinition;
  search(query: ExpertResearchQuery): Promise<ExpertResearchSourceResult>;
}
