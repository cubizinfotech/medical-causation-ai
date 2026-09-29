import type { ProviderDefinition } from '../expert-research.types';

/**
 * Independent research providers. Live HTTP is not connected.
 * Mock mode uses fixtures only where a fixture exists. Other providers return
 * unavailable and do not invent credentials, publications, cases, or records.
 * Restricted providers are never scraped. LexisNexis is authorized access only.
 */
function source(
  definition: Omit<ProviderDefinition, 'liveImplemented'>,
): ProviderDefinition {
  return { ...definition, liveImplemented: false };
}

export const EXPERT_RESEARCH_CATALOG: readonly ProviderDefinition[] = [
  source({
    id: 'web_search',
    name: 'General web research',
    category: 'web',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'WEB_SEARCH_API_KEY',
    summary:
      'Paid search API. Not called locally. A same-name hit is not merged unless city or specialty also agrees.',
  }),
  source({
    id: 'cv_profile',
    name: 'CV and profile research',
    category: 'profile',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'A CV or profile the user supplies, or a future public API. No unrestricted crawl.',
  }),
  source({
    id: 'education_verification',
    name: 'Education and degree verification',
    category: 'education',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Registrar or user-supplied education records. No degree is invented.',
  }),
  source({
    id: 'university_accreditation',
    name: 'University accreditation',
    category: 'university',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public accreditation listings supplied for the investigation. No crawl.',
  }),
  source({
    id: 'state_license',
    name: 'State medical licenses',
    category: 'license',
    accessClass: 'public',
    requirement: 'manual',
    credentialEnv: 'STATE_LICENSE_API_KEY',
    summary:
      'Official license API or a user-supplied record. Do not scrape boards whose terms forbid it.',
  }),
  source({
    id: 'state_discipline',
    name: 'State disciplinary and board actions',
    category: 'license',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Official board action records. Do not scrape boards whose terms forbid it. No action is invented.',
  }),
  source({
    id: 'board_certification',
    name: 'Board certification verification',
    category: 'board_certification',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Certifying-board verification the user supplies or a future official API. No certification is invented.',
  }),
  source({
    id: 'certification_organization',
    name: 'Certification organization verification',
    category: 'certification_organization',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Organization record supplied for the investigation. No membership is invented.',
  }),
  source({
    id: 'pubmed',
    name: 'Publications (PubMed / NCBI)',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'PUBMED_API_KEY',
    summary:
      'Free NCBI E-utilities. An API key is optional. Not called locally.',
  }),
  source({
    id: 'author_verification',
    name: 'Author and co-author verification',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'Compares publication statements already retrieved. Not a separate paid database.',
  }),
  source({
    id: 'lead_author_verification',
    name: 'Lead and first-author verification',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'Compares author-position statements already retrieved. No author order is invented.',
  }),
  source({
    id: 'crossref',
    name: 'Crossref',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'CROSSREF_MAILTO',
    summary:
      'Free Crossref REST API. A mailto address is recommended. Not called locally.',
  }),
  source({
    id: 'openalex',
    name: 'OpenAlex',
    category: 'publication',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'OPENALEX_API_KEY',
    summary: 'Free OpenAlex API. An API key is optional. Not called locally.',
  }),
  source({
    id: 'orcid',
    name: 'ORCID',
    category: 'identity',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'ORCID_CLIENT_ID',
    summary:
      'Free public ORCID API. A member client id is optional. Not called locally.',
  }),
  source({
    id: 'grants',
    name: 'Grants',
    category: 'grant',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'Free NIH RePORTER-style grant search. No key required. Not called locally.',
  }),
  source({
    id: 'grant_results',
    name: 'Grant results',
    category: 'grant',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'Public grant outcome pages when a source is connected. No result is invented.',
  }),
  source({
    id: 'patents',
    name: 'Patents',
    category: 'patent',
    accessClass: 'public',
    requirement: 'free_api',
    credentialEnv: 'USPTO_API_KEY',
    summary:
      'Free USPTO search. An API key may be required. Not called locally.',
  }),
  source({
    id: 'trademarks',
    name: 'Trademarks',
    category: 'trademark',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'Public trademark search. Not called locally. An empty result is not evidence that no mark exists.',
  }),
  source({
    id: 'awards',
    name: 'Awards and medals',
    category: 'award',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Authoritative award listings or user-supplied records. No award is invented.',
  }),
  source({
    id: 'military_claims',
    name: 'Military claims',
    category: 'military',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public authoritative military records the investigation can use. No military service or medal is invented.',
  }),
  source({
    id: 'memberships',
    name: 'Professional memberships',
    category: 'membership',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public organization membership records compared with CV claims. No membership is invented.',
  }),
  source({
    id: 'professional_organizations',
    name: 'Professional organizations',
    category: 'membership',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public professional organization records. Membership is verified only when public evidence exists.',
  }),
  source({
    id: 'courtlistener',
    name: 'Legal cases (CourtListener)',
    category: 'legal',
    accessClass: 'public',
    requirement: 'account',
    credentialEnv: 'COURTLISTENER_API_TOKEN',
    summary:
      'Free Law Project API. A free account token is required. Not called locally.',
  }),
  source({
    id: 'justia',
    name: 'Justia',
    category: 'legal',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public Justia case links the user supplies or a future permitted API. No case is invented and no restricted page is scraped.',
  }),
  source({
    id: 'state_court_records',
    name: 'State court records',
    category: 'legal',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public state court dockets and opinions that are legally available. No record is invented and no login wall is bypassed.',
  }),
  source({
    id: 'motions',
    name: 'Motions',
    category: 'motion',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public docket motions supplied for the investigation. No motion is invented.',
  }),
  source({
    id: 'orders',
    name: 'Orders',
    category: 'court_order',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public court orders supplied for the investigation. No order is invented.',
  }),
  source({
    id: 'pleadings',
    name: 'Pleadings',
    category: 'motion',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public pleadings supplied for the investigation. No pleading is invented.',
  }),
  source({
    id: 'depositions',
    name: 'Depositions',
    category: 'deposition',
    accessClass: 'restricted',
    requirement: 'manual',
    summary:
      'Depositions are not scraped. A user-supplied transcript reference may be recorded as permitted metadata only.',
  }),
  source({
    id: 'expert_testimony',
    name: 'Expert testimony',
    category: 'testimony',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Testimony references the user supplies. No testimony is invented.',
  }),
  source({
    id: 'lexisnexis',
    name: 'LexisNexis',
    category: 'legal',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'LEXISNEXIS_API_KEY',
    summary:
      'Authorized subscription access only. No request is sent from this adapter, and LexisNexis PDFs are not stored.',
  }),
  source({
    id: 'expert_directory',
    name: 'Expert directories',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'EXPERT_DIRECTORY_API_KEY',
    summary:
      'Commercial directories. Subscription or manual export only. No scraping.',
  }),
  source({
    id: 'dri',
    name: 'DRI',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'DRI_API_KEY',
    summary: 'DRI membership or subscription access only. No scraping.',
  }),
  source({
    id: 'seak',
    name: 'SEAK',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'SEAK_API_KEY',
    summary: 'SEAK subscription or manual export only. No scraping.',
  }),
  source({
    id: 'alm_law',
    name: 'ALM / Law.com',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'ALM_API_KEY',
    summary: 'ALM subscription access only. No scraping.',
  }),
  source({
    id: 'jurispro',
    name: 'JurisPro',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'JURISPRO_API_KEY',
    summary: 'JurisPro subscription or manual export only. No scraping.',
  }),
  source({
    id: 'expertlaw',
    name: 'ExpertLaw',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'EXPERTLAW_API_KEY',
    summary: 'ExpertLaw subscription or manual export only. No scraping.',
  }),
  source({
    id: 'expertpages',
    name: 'ExpertPages',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'EXPERTPAGES_API_KEY',
    summary: 'ExpertPages subscription or manual export only. No scraping.',
  }),
  source({
    id: 'expertwitness_com',
    name: 'ExpertWitness.com',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'EXPERTWITNESS_API_KEY',
    summary:
      'ExpertWitness.com subscription or manual export only. No scraping.',
  }),
  source({
    id: 'other_expert_directories',
    name: 'Other expert directories',
    category: 'directory',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'OTHER_DIRECTORY_API_KEY',
    summary:
      'Other commercial directories. Subscription or manual export only. No scraping.',
  }),
  source({
    id: 'expert_website',
    name: 'Expert websites',
    category: 'website',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'A site URL supplied for the investigation. No general web crawl. Copyrighted page bodies are not copied unless permitted.',
  }),
  source({
    id: 'ime_websites',
    name: 'IME websites',
    category: 'ime',
    accessClass: 'public',
    requirement: 'manual',
    summary: 'An IME site URL supplied for the investigation. No crawl.',
  }),
  source({
    id: 'advertising',
    name: 'Advertising',
    category: 'advertising',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'ADVERTISING_DIRECTORY_API_KEY',
    summary:
      'Commercial advertising directories. Subscription or manual access only. No scraping.',
  }),
  source({
    id: 'other_public_websites',
    name: 'Other public websites',
    category: 'website',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Other publicly accessible pages supplied for the investigation. No scrape of restricted content and no copyrighted body copy unless permitted.',
  }),
  source({
    id: 'ime_advertising',
    name: 'IME advertising',
    category: 'advertising',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'IME_DIRECTORY_API_KEY',
    summary:
      'IME advertising directories. Subscription or manual access only. No scraping.',
  }),
  source({
    id: 'youtube',
    name: 'YouTube and videos',
    category: 'video',
    accessClass: 'public',
    requirement: 'account',
    credentialEnv: 'YOUTUBE_API_KEY',
    summary:
      'YouTube Data API. Public video metadata only. Transcripts are stored only when legally and technically permitted. Not called locally.',
  }),
  source({
    id: 'presentations',
    name: 'Presentations',
    category: 'presentation',
    accessClass: 'public',
    requirement: 'manual',
    summary: 'Presentation references the user supplies. No talk is invented.',
  }),
  source({
    id: 'powerpoints',
    name: 'PowerPoints',
    category: 'powerpoint',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Slide decks the user supplies. File bytes from restricted sources are not stored.',
  }),
  source({
    id: 'social',
    name: 'Social media',
    category: 'social',
    accessClass: 'restricted',
    requirement: 'user_credentials',
    credentialEnv: 'SOCIAL_API_KEY',
    summary:
      'Official platform APIs for publicly accessible content only. No friend requests, no private accounts, no bypass of privacy controls, and no scraping.',
  }),
  source({
    id: 'news',
    name: 'News',
    category: 'news',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'NEWS_API_KEY',
    summary:
      'News API with an account or paid plan. Not called locally. Do not scrape sites that forbid it.',
  }),
  source({
    id: 'blogs',
    name: 'Blogs',
    category: 'news',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Blog URLs supplied for the investigation. Do not scrape sites that forbid it.',
  }),
  source({
    id: 'university',
    name: 'University employment and activity rules',
    category: 'university_rules',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Faculty or policy pages the user supplies. No unrestricted crawl.',
  }),
  source({
    id: 'google_maps',
    name: 'Google Maps and location',
    category: 'location',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'GOOGLE_MAPS_API_KEY',
    summary:
      'Maps Platform API. Not called locally. No address is invented from a name match.',
  }),
  source({
    id: 'patient_reviews',
    name: 'Patient reviews',
    category: 'patient_review',
    accessClass: 'restricted',
    requirement: 'manual',
    summary:
      'Review sites are not scraped. A user-supplied public review link may be stored as metadata.',
  }),
  source({
    id: 'open_payments',
    name: 'Open Payments',
    category: 'income_bias',
    accessClass: 'public',
    requirement: 'free_api',
    summary:
      'CMS Open Payments public data. Not called locally. No payment is invented.',
  }),
  source({
    id: 'corporate_affiliations',
    name: 'Corporate affiliations',
    category: 'corporate_affiliation',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Affiliation records the user supplies. No company relationship is invented.',
  }),
  source({
    id: 'criminal_records',
    name: 'Criminal records',
    category: 'criminal_record',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'CRIMINAL_RECORDS_API_KEY',
    summary:
      'Authorized access only. No scraping, and no criminal record is invented.',
  }),
  source({
    id: 'malpractice_records',
    name: 'Malpractice records',
    category: 'malpractice',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'MALPRACTICE_RECORDS_API_KEY',
    summary:
      'Authorized access only. NPDB and similar databases are not scraped, and no claim is invented.',
  }),
];
