import {
  WEB_RESEARCH_SOURCE_IDS,
  WEB_SOURCE_LABEL,
} from '../../web-research/source-kind';
import type { ProviderDefinition } from '../expert-research.types';

/**
 * Independent research providers.
 * Live mode calls the connected public sources (NPI Registry, Open Payments,
 * OpenAlex, CourtListener, Justia, PubMed, NIH RePORTER, ORCID, and YouTube
 * Data API when a key is set). Mock mode uses fixtures only where a fixture
 * exists. Other providers return unavailable and do not invent credentials,
 * publications, cases, or records. Restricted providers are never scraped.
 * LexisNexis is authorized access only.
 */
function source(
  definition: Omit<ProviderDefinition, 'liveImplemented'>,
  liveImplemented = false,
): ProviderDefinition {
  return { ...definition, liveImplemented };
}

/** Sources with a real adapter when RESEARCH_PROVIDER=live. */
export const LIVE_SOURCE_IDS = [
  'npi_registry',
  'open_payments',
  'openalex',
  'courtlistener',
  'justia',
  'pubmed',
  'grants',
  'orcid',
  'state_license',
  'state_discipline',
  // Answered by the global web research layer.
  ...WEB_RESEARCH_SOURCE_IDS,
] as const;

const WEB_SOURCE_ID_SET = new Set<string>(WEB_RESEARCH_SOURCE_IDS);

/**
 * Sources the global web research layer answers in live mode. They find and
 * read public pages through the configured search providers; content behind
 * a login, CAPTCHA, robots.txt rule or paywall is reported as not read.
 */
function withWebResearch(
  entries: readonly ProviderDefinition[],
): readonly ProviderDefinition[] {
  return entries.map((entry) => {
    if (!WEB_SOURCE_ID_SET.has(entry.id)) return entry;
    if (entry.id === 'youtube') {
      return {
        ...entry,
        accessClass: 'public' as const,
        requirement: 'account' as const,
        credentialEnv: 'YOUTUBE_API_KEY',
        liveImplemented: true,
        summary:
          'YouTube Data API v3 when YOUTUBE_API_KEY is set: public video title, channel, date, URL, description, and whether captions exist. Captions are not downloaded (captions.download is owner-only). AssemblyAI may transcribe at most two direct public media files (mp3/mp4); YouTube watch URLs are never submitted. Without a key, public web search for youtube.com and vimeo.com pages is used instead. A same-name video is not attributed unless the listing also supports the specialty or place.',
      };
    }
    const label = WEB_SOURCE_LABEL[entry.id] ?? 'public web pages';
    return {
      ...entry,
      accessClass: 'public' as const,
      requirement: 'free_api' as const,
      credentialEnv: undefined,
      liveImplemented: true,
      summary: `Public web research: finds and reads ${label} for this person through the configured search providers (Gemini Google Search grounding, news indexes, and any Serper/Brave/Tavily key). A page behind a login, CAPTCHA, robots.txt rule or paywall is listed as not read and never bypassed. Same-name pages are attributed only when the profession, place, NPI or intake note agrees.`,
    };
  });
}

const BASE_CATALOG: readonly ProviderDefinition[] = [
  source(
    {
      id: 'npi_registry',
      name: 'NPI Registry (NPPES)',
      category: 'identity',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'Free CMS NPI Registry. Confirms the expert by NPI, name, practice city, and taxonomy before other sources are attributed to them. Lists licenses as self-reported to NPPES.',
    },
    true,
  ),
  source({
    id: 'web_search',
    name: 'General web research',
    category: 'web',
    accessClass: 'public',
    requirement: 'paid_api',
    credentialEnv: 'WEB_SEARCH_API_KEY',
    summary:
      'Catalog label only; WEB_SEARCH_API_KEY is not read. Public-web search uses GEMINI_API_KEY, SERPER_API_KEY, BRAVE_SEARCH_API_KEY, TAVILY_API_KEY, Google News RSS, and GDELT. A same-name hit is not merged unless city or specialty also agrees.',
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
  source(
    {
      id: 'state_license',
      name: 'State medical licenses',
      category: 'license',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'Official Florida Department of Health license lookup when the expert is tied to Florida by city or a Florida license number listed on NPPES. NPPES numbers are a search hint only. A blocked page is reported as inaccessible, not as an invalid license. Other states are not searched by this adapter.',
    },
    true,
  ),
  source(
    {
      id: 'state_discipline',
      name: 'State disciplinary and board actions',
      category: 'license',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'Public discipline flag from the same official Florida Department of Health lookup. An empty or missing flag is not proof that no discipline exists. Other states are not searched by this adapter.',
    },
    true,
  ),
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
  source(
    {
      id: 'pubmed',
      name: 'Publications (PubMed / NCBI)',
      category: 'publication',
      accessClass: 'public',
      requirement: 'free_api',
      credentialEnv: 'PUBMED_API_KEY',
      summary:
        'Free NCBI E-utilities. Lists PubMed articles whose author name matches the expert’s last name and initials. Affiliation is not confirmed from the summary alone.',
    },
    true,
  ),
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
      'Free Crossref REST API used in live mode for publication DOI/authorship checks. CROSSREF_MAILTO is an optional polite contact; OPENALEX_MAILTO or PUBMED_EMAIL is used when it is empty. This is not a paid key.',
  }),
  source(
    {
      id: 'openalex',
      name: 'OpenAlex',
      category: 'publication',
      accessClass: 'public',
      requirement: 'free_api',
      credentialEnv: 'OPENALEX_API_KEY',
      summary:
        'Free OpenAlex API. An author profile is used only when the name, research topics, and an institution location all fit. Lists top-cited, recent, and retracted works. An API key is optional.',
    },
    true,
  ),
  source(
    {
      id: 'orcid',
      name: 'ORCID',
      category: 'identity',
      accessClass: 'public',
      requirement: 'free_api',
      credentialEnv: 'ORCID_CLIENT_ID',
      summary:
        'Free ORCID Public API v3.0. Search and public record reads use a client-credentials token (ORCID_CLIENT_ID and ORCID_CLIENT_SECRET from orcid.org/developer-tools). A name match is not enough; affiliation, specialty, a supplied ORCID iD, or a named publication identifier must also agree. Works on an unconfirmed profile are not attributed. A missing ORCID record is not proof that a publication does not exist.',
    },
    true,
  ),
  source(
    {
      id: 'grants',
      name: 'Grants',
      category: 'grant',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'Free NIH RePORTER search. Lists grants whose investigator name matches. A grant is not proof of identity unless the organization also fits.',
    },
    true,
  ),
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
  source(
    {
      id: 'courtlistener',
      name: 'Legal cases (CourtListener)',
      category: 'legal',
      accessClass: 'public',
      requirement: 'free_api',
      credentialEnv: 'COURTLISTENER_API_TOKEN',
      summary:
        'Free Law Project case law and public RECAP filings. Keeps opinions and public motions, orders, pleadings, or transcripts that contain the expert’s full name and a specialty term. One opinion is not a complete docket. A free token adds document excerpts. PACER logins and paywalled files are not used.',
    },
    true,
  ),
  source(
    {
      id: 'justia',
      name: 'Justia',
      category: 'legal',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'Public Justia case search by the expert’s full name. A page that cannot be read is reported as not searched, not as no cases.',
    },
    true,
  ),
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
      'YouTube Data API v3. Public video metadata only. Transcripts are not retrieved.',
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
  source(
    {
      id: 'open_payments',
      name: 'Open Payments',
      category: 'income_bias',
      accessClass: 'public',
      requirement: 'free_api',
      summary:
        'CMS Open Payments general payments, searched only by the confirmed NPI. Totals are summed by CMS per year, company, and payment type. No payment is invented.',
    },
    true,
  ),
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
    name: 'Criminal background',
    category: 'criminal_record',
    accessClass: 'restricted',
    requirement: 'subscription',
    credentialEnv: 'CRIMINAL_RECORDS_API_KEY',
    summary:
      'Authorized access only. Public criminal sources are not scraped, and no criminal record is invented. An empty check is not proof that no record exists.',
  }),
  source({
    id: 'constitutional_sheriff',
    name: 'Constitutional Sheriff movement',
    category: 'membership',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public organization pages only. A name, event, article, law-enforcement job, or political opinion is not membership. No page is scraped.',
  }),
  source({
    id: 'post_records',
    name: 'Peace Officer Standards and Training',
    category: 'certification_organization',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'State POST sites differ. No state agency is chosen from the city alone, and no POST website is scraped.',
  }),
  source({
    id: 'oath_keepers',
    name: 'Oath Keepers',
    category: 'membership',
    accessClass: 'public',
    requirement: 'manual',
    summary:
      'Public pages only. Membership is recorded only when a public source states it and the identity matches. Restricted sources are not used.',
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

export const EXPERT_RESEARCH_CATALOG: readonly ProviderDefinition[] =
  withWebResearch(BASE_CATALOG);
