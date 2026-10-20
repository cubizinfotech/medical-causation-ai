/**
 * Contracts for the global web research layer.
 * A SearchProvider finds candidate pages. Nothing a provider returns is a
 * finding until the page is read (or its limits are stated) and the person
 * is matched against the subject.
 */

export type WebSearchKind = 'web' | 'news' | 'places' | 'scholar';

export interface WebResearchQuery {
  expertName: string;
  city: string;
  specialty: string;
  npi?: string;
  /** Free text from the attorney: alternate names, affiliations, instructions. */
  context?: string;
}

export interface SearchRequest {
  /** Operator-style query for classic search engines. */
  query: string;
  /** Natural-language request for LLM-backed search (Gemini grounding). */
  prompt?: string;
  kind: WebSearchKind;
  page?: number;
  num?: number;
}

export interface SearchPlace {
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
}

export interface SearchHit {
  url: string;
  title: string;
  snippet?: string;
  publishedAt?: string;
  providerId: string;
  query: string;
  kind: WebSearchKind;
  place?: SearchPlace;
  /**
   * Model sentence about this page from a grounded search. A research lead
   * only: it is not a finding until a fetched page supports it.
   */
  lead?: string;
  /**
   * Full grounded answer for this query (set on the first hit). A lead, not
   * a finding.
   */
  answer?: string;
}

export type SearchFailureKind =
  | 'timeout'
  | 'rate_limited'
  | 'quota'
  | 'auth'
  | 'http'
  | 'network'
  | 'unsupported';

export class SearchProviderError extends Error {
  constructor(
    message: string,
    readonly kind: SearchFailureKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SearchProviderError';
  }
}

export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  readonly kinds: readonly WebSearchKind[];
  /** Most requests this provider may make for one investigation. */
  readonly budget: number;
  readonly concurrency: number;
  isConfigured(): boolean;
  search(request: SearchRequest, timeoutMs: number): Promise<SearchHit[]>;
}

/** What kind of page a result is. Drives which catalog source it belongs to. */
export type WebSourceKind =
  | 'social'
  | 'news'
  | 'blog'
  | 'directory'
  | 'review'
  | 'video'
  | 'presentation'
  | 'court'
  | 'justia'
  | 'corporate'
  | 'publication'
  | 'university'
  | 'expert_website'
  | 'advertising'
  | 'ime'
  | 'maps'
  | 'profile'
  | 'other';

export const WEB_SOURCE_KINDS: readonly WebSourceKind[] = [
  'social',
  'news',
  'blog',
  'directory',
  'review',
  'video',
  'presentation',
  'court',
  'justia',
  'corporate',
  'publication',
  'university',
  'expert_website',
  'advertising',
  'ime',
  'maps',
  'profile',
  'other',
];

export type PageReadStatus =
  'read' | 'snippet_only' | 'restricted' | 'failed' | 'not_read';

export type MatchLevel =
  'strong' | 'possible' | 'weak' | 'other_person' | 'none';

export type MatchConfidence = 'high' | 'medium' | 'low';

/** What a statement on a page is about. Routes it to the right report section. */
export type WebClaimTopic =
  | 'education'
  | 'board_certification'
  | 'certification_org'
  | 'license'
  | 'discipline'
  | 'membership'
  | 'publication'
  | 'grant'
  | 'patent'
  | 'award'
  | 'military'
  | 'employment'
  | 'corporate'
  | 'office'
  | 'review'
  | 'advertising'
  | 'ime'
  | 'order'
  | 'pleading'
  | 'deposition'
  | 'testimony'
  | 'criminal'
  | 'university_rules'
  | 'other';

export const WEB_CLAIM_TOPICS: readonly WebClaimTopic[] = [
  'education',
  'board_certification',
  'certification_org',
  'license',
  'discipline',
  'membership',
  'publication',
  'grant',
  'patent',
  'award',
  'military',
  'employment',
  'corporate',
  'office',
  'review',
  'advertising',
  'ime',
  'order',
  'pleading',
  'deposition',
  'testimony',
  'criminal',
  'university_rules',
  'other',
];

/**
 * Who stands behind a statement. Only a page from the issuing body or an
 * official registry is a primary source; everything else is reported as it
 * was said.
 */
export type WebClaimBasis =
  'subject_stated' | 'third_party' | 'primary_source' | 'allegation';

export interface WebClaim {
  type:
    | 'advertising'
    | 'forensic'
    | 'credential'
    | 'allegation'
    | 'rating'
    | 'other';
  text: string;
  /** Verbatim text from the page that supports the claim. */
  quote: string;
  topic?: WebClaimTopic;
  basis?: WebClaimBasis;
  /** "page" when the quote was found in the page text; "snippet" when it comes from a search result and the page was not read. */
  from?: 'page' | 'snippet';
}

/** A business named on a page that also names the subject. */
export interface WebCompanyTie {
  name: string;
  url: string;
  /** "own_page": the subject's own site or profile. "other_page": any other page. */
  scope: 'own_page' | 'other_page';
  quote: string | null;
}

/**
 * A credential claim compared with the issuing body or an official registry.
 * "confirmed" needs a page from that body that names the person.
 */
export interface WebVerification {
  id: string;
  topic: WebClaimTopic;
  claim: string;
  status: 'confirmed' | 'not_confirmed' | 'not_checked';
  /** Where the claim was made (subject's own pages, courts, directories). */
  claimedAt: string[];
  /** The official page that confirms it, when one was read. */
  confirmedBy: { name: string; url: string; quote: string | null } | null;
  note: string;
}

/** How many targeted searches ran for a report topic and what they returned. */
export interface WebTopicCoverage {
  topic: string;
  queries: number;
  hits: number;
}

export interface WebRecord {
  id: string;
  url: string;
  title: string;
  kind: WebSourceKind;
  /** Social platform for kind "social". */
  platform?: string;
  /** Catalog directory id for kind "directory". */
  directoryId?: string;
  snippet: string | null;
  summary: string;
  publishedAt: string | null;
  retrievedAt: string;
  searchProviders: string[];
  queries: string[];
  read: PageReadStatus;
  /** Why the page was not read, or what limited it. */
  readNote: string | null;
  /** Internet Archive copy the text was read from, when the site blocks bots. */
  archiveUrl?: string;
  match: {
    level: MatchLevel;
    confidence: MatchConfidence | null;
    basis: string[];
    conflicts: string[];
    /** Verbatim text that ties the page to the subject. */
    quote: string | null;
    quoteVerified: boolean;
    classifiedBy: 'model' | 'rules';
  };
  candidateId: string | null;
  claims: WebClaim[];
  place?: SearchPlace;
  rating?: string | null;
}

export interface WebCandidate {
  id: string;
  label: string;
  role: 'subject' | 'other';
  confidence: MatchConfidence;
  basis: string[];
  recordIds: string[];
}

export interface WebProviderReport {
  providerId: string;
  name: string;
  configured: boolean;
  requests: number;
  /** Requests that failed. The failures list names each distinct problem once. */
  failedRequests: number;
  hits: number;
  failures: Array<{ kind: SearchFailureKind | 'skipped'; message: string }>;
}

export interface WebBlockedPage {
  url: string;
  reason: string;
}

export interface WebResearchDossier {
  ranAt: string;
  durationMs: number;
  partial: boolean;
  partialNote: string | null;
  queriesPlanned: number;
  queriesRun: number;
  providers: WebProviderReport[];
  pagesRead: number;
  pagesBlocked: WebBlockedPage[];
  candidates: WebCandidate[];
  records: WebRecord[];
  /** Direct public-registry checks (e.g. Sunbiz), outside the search engines. */
  registries: Array<{
    id: string;
    name: string;
    status: 'checked' | 'failed' | 'not_applicable';
    message: string;
    url?: string;
  }>;
  /** Plain-language limits of this run for the report. */
  limitations: string[];
  /** Targeted searches per report topic. Absent in dossiers saved before version 3.3. */
  topics?: WebTopicCoverage[];
  /** Businesses named on pages that name the subject. */
  companies?: WebCompanyTie[];
  /** Credential claims compared with the issuing bodies. */
  verifications?: WebVerification[];
  /**
   * A public photo of the subject, only when a fetched page about this
   * person published one. Not present when none could be read.
   */
  portrait?: ExpertPortrait | null;
}

export interface ExpertPortrait {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Page the photo was taken from. */
  sourceUrl: string;
  /** The image file itself. */
  imageUrl: string;
}

export interface WebResearchSettings {
  providers: string[];
  serperApiKey?: string;
  braveApiKey?: string;
  tavilyApiKey?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  maxQueries: number;
  maxPages: number;
  searchTimeoutMs: number;
  fetchTimeoutMs: number;
  maxFetchPages: number;
  deadlineMs: number;
  /** Read the Internet Archive copy of a page whose site blocks bots. Default true. */
  archiveFallback?: boolean;
}

/** Text-in, text-out model call used for classification. */
export type WebResearchLlm = (input: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<string>;
