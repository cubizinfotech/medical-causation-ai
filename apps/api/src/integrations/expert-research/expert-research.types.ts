/**
 * Expert research provider contracts.
 * EWI calls ExpertResearchService. Providers do not get called from product business logic.
 */

export type ExpertResearchProviderId =
  | 'web_search'
  | 'pubmed'
  | 'author_verification'
  | 'orcid'
  | 'crossref'
  | 'openalex'
  | 'grants'
  | 'patents'
  | 'state_license'
  | 'expert_directory'
  | 'courtlistener'
  | 'lexisnexis'
  | 'youtube'
  | 'news'
  | 'social'
  | 'university'
  | 'expert_website'
  | 'ime_advertising';

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
  specialty: string;
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
  retrievedAt?: string;
  source?: SourceMetadata;
}

export interface ExpertResearchSourceResult {
  sourceId: ExpertResearchProviderId;
  status: 'ok' | 'skipped' | 'error' | 'unavailable';
  access: SourceAccessClass;
  message?: string;
  retrievedAt: string;
  items: ExpertEvidenceItem[];
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
  /** Live HTTP is intentionally not connected. */
  liveImplemented: false;
  summary: string;
}

export interface IExpertResearchProvider {
  readonly id: ExpertResearchProviderId;
  readonly definition: ProviderDefinition;
  search(query: ExpertResearchQuery): Promise<ExpertResearchSourceResult>;
}
