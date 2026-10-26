import type { WebSearchKind, WebSourceKind } from './web-research.types';

export interface UrlClassification {
  kind: WebSourceKind;
  platform?: string;
  directoryId?: string;
  /** The site shows content only to signed-in users. It is never fetched. */
  loginGated: boolean;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostIs(value: string, domains: readonly string[]): boolean {
  return domains.some((d) => value === d || value.endsWith(`.${d}`));
}

const SOCIAL: Record<string, { platform: string; gated: boolean }> = {
  'facebook.com': { platform: 'facebook', gated: true },
  'fb.com': { platform: 'facebook', gated: true },
  'instagram.com': { platform: 'instagram', gated: true },
  'linkedin.com': { platform: 'linkedin', gated: true },
  'twitter.com': { platform: 'x', gated: true },
  'x.com': { platform: 'x', gated: true },
  'tiktok.com': { platform: 'tiktok', gated: true },
  'threads.net': { platform: 'other', gated: true },
  'bsky.app': { platform: 'bluesky', gated: false },
  'reddit.com': { platform: 'other', gated: true },
  'pinterest.com': { platform: 'other', gated: true },
};

const DIRECTORIES: Array<{ id: string; domains: string[] }> = [
  { id: 'seak', domains: ['seakexperts.com', 'seak.com'] },
  { id: 'jurispro', domains: ['jurispro.com'] },
  { id: 'alm_law', domains: ['almexperts.com', 'law.com'] },
  { id: 'expertlaw', domains: ['expertlaw.com'] },
  { id: 'expertpages', domains: ['expertpages.com'] },
  { id: 'expertwitness_com', domains: ['expertwitness.com'] },
  { id: 'dri', domains: ['dri.org'] },
  {
    id: 'other_expert_directories',
    domains: [
      'hgexperts.com',
      'experts.com',
      'witness.net',
      'freereferral.com',
      'washlaw.edu',
      'biomedexperts.com',
      'exponente.com',
      'forensisgroup.com',
      'testifyingexpert.com',
      'expertinstitute.com',
      'expertwitnessprofiler.com',
      'theaacn.org',
      'thelitigationconsultant.com',
      'trialsmith.com',
      'litigationexperts.com',
    ],
  },
];

const REVIEW_DOMAINS = [
  'healthgrades.com',
  'vitals.com',
  'ratemds.com',
  'zocdoc.com',
  'yelp.com',
  'webmd.com',
  'trustpilot.com',
  'bbb.org',
  'ratemyprofessor.com',
  'avvo.com',
  'psychologytoday.com',
  'wellness.com',
  'doximity.com',
  'sharecare.com',
  'realself.com',
  'birdeye.com',
  'mapquest.com',
  'yellowpages.com',
  'superpages.com',
  'manta.com',
];

const NEWS_DOMAINS =
  /(^|\.)(courttv\.com|cnn\.com|foxnews\.com|nbcnews\.com|cbsnews\.com|abcnews\.go\.com|apnews\.com|reuters\.com|npr\.org|usatoday\.com|nytimes\.com|washingtonpost\.com|law360\.com|abajournal\.com|law\.com|wftv\.com|wesh\.com|wkmg\.com|wfla\.com|wtsp\.com|news4jax\.com|firstcoastnews\.com|ocala\.com|gainesville\.com|mainstreetdailynews\.com|alligator\.org|wcjb\.com|tampabay\.com|orlandosentinel\.com|sun-sentinel\.com|miamiherald\.com|jacksonville\.com|news-journalonline\.com|newsbreak\.com|yahoo\.com)$|news|times|herald|tribune|gazette|courier|chronicle|dispatch|journal\b|post\b/;

const COURT_DOMAINS = [
  'courtlistener.com',
  'casetext.com',
  'leagle.com',
  'govinfo.gov',
  'uscourts.gov',
  'casemine.com',
  'anylaw.com',
  'vlex.com',
  'findacase.com',
  'courtlistener.org',
  'pacermonitor.com',
  'docketalarm.com',
  'unicourt.com',
  'trellis.law',
  'govinfo.gov',
  'casebriefs.com',
  'law.cornell.edu',
  'fdlp.gov',
  'flcourts.gov',
  'myflcourtaccess.com',
  'floridasupremecourt.org',
  'flsd.uscourts.gov',
  'flmd.uscourts.gov',
];

const CORPORATE_DOMAINS = [
  'sunbiz.org',
  'opencorporates.com',
  'bizapedia.com',
  'corporationwiki.com',
  'bizprofile.net',
  'dnb.com',
  'floridacompanies.com',
  'buzzfile.com',
  'sec.gov',
  'florida-companies.com',
  'bizstanding.com',
  'cortera.com',
];

const PUBLICATION_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'doi.org',
  'researchgate.net',
  'scholar.google.com',
  'semanticscholar.org',
  'sciencedirect.com',
  'springer.com',
  'link.springer.com',
  'wiley.com',
  'onlinelibrary.wiley.com',
  'tandfonline.com',
  'academia.edu',
  'orcid.org',
  'europepmc.org',
  'openalex.org',
  'journals.lww.com',
  'academic.oup.com',
  'cambridge.org',
  'frontiersin.org',
  'nih.gov',
];

/** Deterministic first guess from the address. The model may refine it. */
export function classifyUrl(
  url: string,
  searchKind: WebSearchKind,
): UrlClassification {
  const h = host(url);
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();

  for (const [domain, info] of Object.entries(SOCIAL)) {
    if (hostIs(h, [domain])) {
      return {
        kind: 'social',
        platform: info.platform,
        loginGated: info.gated,
      };
    }
  }
  if (hostIs(h, ['youtube.com', 'youtu.be', 'vimeo.com'])) {
    return {
      kind: 'video',
      platform: h.includes('vimeo') ? 'vimeo' : 'youtube',
      loginGated: false,
    };
  }
  if (
    hostIs(h, ['slideshare.net', 'speakerdeck.com']) ||
    /\.(ppt|pptx)$/.test(path)
  ) {
    return { kind: 'presentation', loginGated: false };
  }
  if (hostIs(h, ['justia.com', 'lawjustia.com'])) {
    return { kind: 'justia', loginGated: false };
  }
  for (const directory of DIRECTORIES) {
    if (hostIs(h, directory.domains)) {
      // law.com is mostly news; its expert listings sit on almexperts.com.
      if (
        directory.id === 'alm_law' &&
        h.endsWith('law.com') &&
        !h.includes('almexperts')
      ) {
        return { kind: 'news', loginGated: false };
      }
      return {
        kind: 'directory',
        directoryId: directory.id,
        loginGated: false,
      };
    }
  }
  if (hostIs(h, REVIEW_DOMAINS)) return { kind: 'review', loginGated: false };
  if (hostIs(h, COURT_DOMAINS) || /(^|\.)courts?\./.test(h)) {
    return { kind: 'court', loginGated: false };
  }
  if (hostIs(h, CORPORATE_DOMAINS))
    return { kind: 'corporate', loginGated: false };
  if (hostIs(h, PUBLICATION_DOMAINS)) {
    return { kind: 'publication', loginGated: false };
  }
  if (
    h.startsWith('maps.') ||
    (h.endsWith('google.com') && path.startsWith('/maps'))
  ) {
    return { kind: 'maps', loginGated: false };
  }
  if (
    hostIs(h, [
      'blogspot.com',
      'medium.com',
      'substack.com',
      'wordpress.com',
    ]) ||
    /(^|\/)blog(s)?(\/|$)/.test(path)
  ) {
    return { kind: 'blog', loginGated: false };
  }
  if (searchKind === 'news' || NEWS_DOMAINS.test(h)) {
    return { kind: 'news', loginGated: false };
  }
  if (h.endsWith('.edu')) return { kind: 'university', loginGated: false };
  return { kind: 'other', loginGated: false };
}

/** Catalog source id for a record, so existing report sections pick it up. */
export function catalogSourceFor(
  kind: WebSourceKind,
  directoryId?: string,
): { sourceId: string; category: string } {
  switch (kind) {
    case 'social':
      return { sourceId: 'social', category: 'social' };
    case 'news':
      return { sourceId: 'news', category: 'news' };
    case 'blog':
      return { sourceId: 'blogs', category: 'news' };
    case 'directory':
      return {
        sourceId: directoryId ?? 'expert_directory',
        category: 'directory',
      };
    case 'review':
      return { sourceId: 'patient_reviews', category: 'patient_review' };
    case 'video':
      return { sourceId: 'youtube', category: 'video' };
    case 'presentation':
      return { sourceId: 'presentations', category: 'presentation' };
    case 'justia':
      return { sourceId: 'justia', category: 'legal' };
    case 'court':
      return { sourceId: 'state_court_records', category: 'legal' };
    case 'corporate':
      return {
        sourceId: 'corporate_affiliations',
        category: 'corporate_affiliation',
      };
    case 'expert_website':
      return { sourceId: 'expert_website', category: 'website' };
    case 'advertising':
      return { sourceId: 'advertising', category: 'advertising' };
    case 'ime':
      return { sourceId: 'ime_websites', category: 'ime' };
    case 'maps':
      return { sourceId: 'google_maps', category: 'office' };
    case 'university':
      return { sourceId: 'university', category: 'profile' };
    case 'publication':
      return { sourceId: 'other_public_websites', category: 'publication' };
    case 'profile':
      return { sourceId: 'web_search', category: 'profile' };
    default:
      return { sourceId: 'other_public_websites', category: 'website' };
  }
}

/** The catalog source ids the web research layer answers. */
export const WEB_RESEARCH_SOURCE_IDS = [
  'web_search',
  'news',
  'blogs',
  'social',
  'expert_directory',
  'dri',
  'seak',
  'alm_law',
  'jurispro',
  'expertlaw',
  'expertpages',
  'expertwitness_com',
  'other_expert_directories',
  'expert_website',
  'ime_websites',
  'advertising',
  'ime_advertising',
  'other_public_websites',
  'youtube',
  'presentations',
  'powerpoints',
  'patient_reviews',
  'google_maps',
  'corporate_affiliations',
  'university',
  'state_court_records',
  'patents',
  'trademarks',
  'awards',
  'military_claims',
  'university_accreditation',
  'depositions',
  'expert_testimony',
  'motions',
  'orders',
  'pleadings',
] as const;

export type WebResearchSourceId = (typeof WEB_RESEARCH_SOURCE_IDS)[number];

/** Plain-language name of what each web-backed source finds. */
export const WEB_SOURCE_LABEL: Record<string, string> = {
  web_search: 'general web pages',
  news: 'news articles',
  blogs: 'blog posts',
  social: 'social media profiles or posts',
  expert_directory: 'expert directory listings',
  dri: 'DRI listings',
  seak: 'SEAK listings',
  alm_law: 'ALM / Law.com listings',
  jurispro: 'JurisPro listings',
  expertlaw: 'ExpertLaw listings',
  expertpages: 'ExpertPages listings',
  expertwitness_com: 'ExpertWitness.com listings',
  other_expert_directories: 'other expert directory listings',
  expert_website: 'expert websites',
  ime_websites: 'IME websites',
  advertising: 'advertising',
  ime_advertising: 'IME advertising',
  other_public_websites: 'other public web pages',
  youtube: 'videos',
  presentations: 'presentations',
  powerpoints: 'slide decks',
  patient_reviews: 'review-site listings',
  google_maps: 'map and business listings',
  corporate_affiliations: 'corporate registry records',
  justia: 'Justia pages',
  university: 'university or faculty pages',
  state_court_records: 'court records',
  patents: 'patents',
  trademarks: 'trademarks',
  awards: 'awards and honors',
  military_claims: 'military-service claims',
  university_accreditation: 'university accreditation listings',
  depositions: 'deposition or testimony mentions',
  expert_testimony: 'expert-testimony mentions',
  motions: 'motions naming the expert',
  orders: 'court orders naming the expert',
  pleadings: 'pleadings naming the expert',
};
