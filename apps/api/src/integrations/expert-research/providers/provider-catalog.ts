import type { ProviderDefinition } from '../expert-research.types';

/**
 * Independent research providers. Live HTTP is not connected.
 * Mock mode uses fixtures only where a fixture exists. Other providers return
 * unavailable and do not invent credentials, publications, or cases.
 */
export const EXPERT_RESEARCH_CATALOG: readonly ProviderDefinition[] = [
  {
    id: 'web_search',
    name: 'General web search',
    category: 'web',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'WEB_SEARCH_API_KEY',
    liveImplemented: false,
    summary:
      'Paid search API (or an account-backed custom search). Not called locally.',
  },
  {
    id: 'pubmed',
    name: 'PubMed / NCBI',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'PUBMED_API_KEY',
    liveImplemented: false,
    summary:
      'Free NCBI E-utilities. An API key is optional and raises the rate limit. Not called locally.',
  },
  {
    id: 'author_verification',
    name: 'Author / publication verification',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    liveImplemented: false,
    summary:
      'Compares publication statements already retrieved from public bibliographic APIs. Not a separate paid database.',
  },
  {
    id: 'orcid',
    name: 'ORCID',
    category: 'identity',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'ORCID_CLIENT_ID',
    liveImplemented: false,
    summary:
      'Free public ORCID API. A member client id is optional. Not called locally.',
  },
  {
    id: 'crossref',
    name: 'Crossref',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'CROSSREF_MAILTO',
    liveImplemented: false,
    summary:
      'Free Crossref REST API. A mailto address is recommended for the polite pool. Not called locally.',
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'OPENALEX_API_KEY',
    liveImplemented: false,
    summary: 'Free OpenAlex API. An API key is optional. Not called locally.',
  },
  {
    id: 'grants',
    name: 'Grants',
    category: 'grant',
    accessClass: 'public',
    requirement: 'free_api',
    liveImplemented: false,
    summary:
      'Free NIH RePORTER-style grant search. No key required. Not called locally.',
  },
  {
    id: 'patents',
    name: 'Patents',
    category: 'patent',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'USPTO_API_KEY',
    liveImplemented: false,
    summary:
      'Free USPTO search. An API key may be required by the chosen endpoint. Not called locally.',
  },
  {
    id: 'state_license',
    name: 'State medical licensing and discipline',
    category: 'license',
    accessClass: 'public',
    requirement: 'manual',
    credentialEnv: 'STATE_LICENSE_API_KEY',
    liveImplemented: false,
    summary:
      'Board sites differ. Use an official API or a user-supplied record. Do not scrape boards whose terms forbid it.',
  },
  {
    id: 'expert_directory',
    name: 'Expert witness directories',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'EXPERT_DIRECTORY_API_KEY',
    liveImplemented: false,
    summary:
      'Commercial directories. Subscription or manual export only. No scraping.',
  },
  {
    id: 'courtlistener',
    name: 'CourtListener',
    category: 'legal',
    accessClass: 'public',
    requirement: 'account',
    credentialEnv: 'COURTLISTENER_API_TOKEN',
    liveImplemented: false,
    summary:
      'Free Law Project API. A free account token is required. Not called locally.',
  },
  {
    id: 'lexisnexis',
    name: 'LexisNexis',
    category: 'legal',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'LEXISNEXIS_API_KEY',
    liveImplemented: false,
    summary:
      'Paid subscription. Interface and configuration only. No request is sent, and content is not stored.',
  },
  {
    id: 'youtube',
    name: 'YouTube / videos',
    category: 'video',
    accessClass: 'public',
    requirement: 'account',
    credentialEnv: 'YOUTUBE_API_KEY',
    liveImplemented: false,
    summary:
      'YouTube Data API. A Google account API key is required. Not called locally.',
  },
  {
    id: 'news',
    name: 'News and blogs',
    category: 'news',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'NEWS_API_KEY',
    liveImplemented: false,
    summary:
      'News API with an account or paid plan. Not called locally. Do not scrape sites that forbid it.',
  },
  {
    id: 'social',
    name: 'Public social media',
    category: 'social',
    accessClass: 'restricted',
    requirement: 'user_credentials',
    credentialEnv: 'SOCIAL_API_KEY',
    liveImplemented: false,
    summary:
      'Official platform APIs and user-provided credentials only. No scraping of profiles.',
  },
  {
    id: 'university',
    name: 'University information',
    category: 'education',
    accessClass: 'public',
    requirement: 'manual',
    liveImplemented: false,
    summary:
      'Faculty pages the user supplies, or a future public API. No unrestricted crawl.',
  },
  {
    id: 'expert_website',
    name: 'Expert websites',
    category: 'profile',
    accessClass: 'public',
    requirement: 'manual',
    liveImplemented: false,
    summary:
      'A site URL supplied for the investigation. No general web crawl in this adapter.',
  },
  {
    id: 'ime_advertising',
    name: 'IME and expert advertising sites',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'IME_DIRECTORY_API_KEY',
    liveImplemented: false,
    summary:
      'Commercial advertising directories. Subscription or manual access only. No scraping.',
  },
];
