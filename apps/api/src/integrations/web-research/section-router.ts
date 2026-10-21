/**
 * Routes what the web research found to the report sections it belongs to.
 *
 * The web run returns pages. A page is not a section: one page can state a
 * degree, a board certification and a membership. This module reads the
 * statements recorded for each page (see claim-topics) and files each one under
 * the section that is about it, with its source, quote and who stands behind it.
 *
 * Pure and deterministic: the same dossier always gives the same sections, and
 * nothing is added that a page did not say.
 */
import {
  officialSourceFor,
  organizationsIn,
  TOPIC_LABEL,
} from './claim-topics';
import type {
  WebClaim,
  WebClaimBasis,
  WebClaimTopic,
  WebRecord,
  WebResearchDossier,
  WebVerification,
} from './web-research.types';

export const ROUTED_SECTION_IDS = [
  'background',
  'education',
  'university-accreditation',
  'licenses',
  'board-actions',
  'board-certifications',
  'certification-orgs',
  'memberships',
  'publications',
  'grants',
  'patents',
  'awards-military',
  'ime',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'income-bias',
  'lawsuits',
  'criminal',
  'corporate',
  'patient-reviews',
  'office-location',
  'admissibility-challenges',
  'university-rules',
  'websites',
  'directories',
  'social',
  'videos',
  'news',
] as const;

export type RoutedSectionId = (typeof ROUTED_SECTION_IDS)[number];

export function isRoutedSection(id: string): id is RoutedSectionId {
  return (ROUTED_SECTION_IDS as readonly string[]).includes(id);
}

export const BASIS_LABEL: Record<WebClaimBasis | 'record', string> = {
  subject_stated: 'Stated by the expert (own website or profile)',
  third_party: 'Stated on a third-party page',
  primary_source:
    'Primary source (the issuing body, a court or an official registry)',
  allegation: 'Reported or alleged; not established',
  record: 'Page that names the expert',
};

export interface RoutedFinding {
  sectionId: RoutedSectionId;
  title: string;
  statement: string;
  quote: string | null;
  url: string;
  sourceTitle: string;
  basis: WebClaimBasis | 'record';
  basisLabel: string;
  matchLevel: 'strong' | 'possible';
  from: 'page' | 'snippet';
  retrievedAt: string;
  publishedAt: string | null;
  /** Comparison with the issuing body, when this kind of claim has one. */
  verification: WebVerification | null;
}

const BASIS_ORDER: Record<WebClaimBasis | 'record', number> = {
  primary_source: 0,
  subject_stated: 1,
  third_party: 2,
  allegation: 3,
  record: 4,
};

/** Report section(s) a topic is filed under. */
const TOPIC_SECTIONS: Partial<Record<WebClaimTopic, RoutedSectionId[]>> = {
  education: ['education', 'university-accreditation'],
  board_certification: ['board-certifications', 'certification-orgs'],
  certification_org: ['certification-orgs'],
  license: ['licenses'],
  membership: ['memberships'],
  publication: ['publications'],
  grant: ['grants'],
  patent: ['patents'],
  award: ['awards-military'],
  military: ['awards-military'],
  employment: ['background'],
  corporate: ['corporate'],
  office: ['office-location'],
  review: ['patient-reviews'],
  advertising: ['ime'],
  ime: ['ime'],
  order: ['orders'],
  pleading: ['pleadings'],
  deposition: ['depositions'],
  testimony: ['testimony-inconsistencies'],
  university_rules: ['university-rules'],
};

const SECTION_VERIFICATION: Partial<Record<RoutedSectionId, WebClaimTopic>> = {
  'board-certifications': 'board_certification',
  'certification-orgs': 'board_certification',
  memberships: 'membership',
  licenses: 'license',
  publications: 'publication',
  grants: 'grant',
  patents: 'patent',
};

function sectionsFor(claim: WebClaim): RoutedSectionId[] {
  const topic = claim.topic ?? 'other';
  const text = `${claim.text} ${claim.quote}`;
  if (topic === 'discipline' || topic === 'criminal') {
    if (
      topic === 'criminal' ||
      /\b(arrest|convict|criminal|charged|felony|misdemeanor)\w*/i.test(text)
    ) {
      return ['criminal'];
    }
    if (
      /\b(board|licens|sanction|revok|suspen|reprimand|probation|administrative complaint|disciplin)\w*/i.test(
        text,
      )
    ) {
      return ['board-actions'];
    }
    if (/\b(malpractice|lawsuit|sued|complaint|negligen)\w*/i.test(text)) {
      return ['lawsuits'];
    }
    return ['board-actions'];
  }
  const sections = [...(TOPIC_SECTIONS[topic] ?? [])];
  // Fees and rates, whatever page type they appear on.
  if (
    topic !== 'other' &&
    /(\$\s?\d[\d,]*(\.\d+)?|\bper hour\b|\bhourly\b|\bretainer\b)/i.test(
      text,
    ) &&
    /\b(fee|rate|retainer|charge|paid|billing|hourly|per hour)\b/i.test(text)
  ) {
    sections.push('income-bias');
  }
  return sections;
}

function tied(record: WebRecord): record is WebRecord & {
  match: { level: 'strong' | 'possible' };
} {
  return record.match.level === 'strong' || record.match.level === 'possible';
}

function short(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const INSTITUTION_OF =
  /\b(?:University|College|Institute|School) of [A-Z][A-Za-z&-]+(?: (?:at |of )?[A-Z][A-Za-z&-]+){0,3}\b/g;
const INSTITUTION_NAMED =
  /\b(?:[A-Z][A-Za-z&-]+ ){1,3}(?:University|College)\b/g;
const NOT_PART_OF_NAME =
  /^(?:He|She|They|Dr|Mr|Ms|The|Her|His|In|At|And|From|With|After|Before)\s+/;

export function institutionsIn(text: string): string[] {
  const found = new Map<string, string>();
  const take = (raw: string) => {
    let name = raw.replace(/\s+/g, ' ').trim();
    while (NOT_PART_OF_NAME.test(name))
      name = name.replace(NOT_PART_OF_NAME, '');
    if (!/(University|College|Institute|School)/.test(name)) return;
    const key = name.toLowerCase();
    if (!found.has(key)) found.set(key, name);
  };
  for (const match of text.matchAll(INSTITUTION_OF)) take(match[0]);
  for (const match of text.matchAll(INSTITUTION_NAMED)) take(match[0]);
  // "University of West Florida" also contains no second "X University".
  return [...found.values()];
}

const LEGAL_SECTIONS: ReadonlySet<RoutedSectionId> = new Set([
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
]);

/** Sections where several sentences of one page say the same thing. */
const ONE_PER_PAGE: ReadonlySet<RoutedSectionId> = new Set([
  'board-certifications',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'ime',
  'publications',
  'background',
  'licenses',
  'education',
  'office-location',
  'social',
]);

/** A quote that states the credential outright reads better than a bare suffix. */
function strength(quote: string | null): number {
  if (!quote) return 0;
  return (
    (/\bboard[- ]certified\b|\bboard certification\b/i.test(quote) ? 2 : 0) +
    (/\bAmerican (Board|Academy) of\b/i.test(quote) ? 2 : 0) +
    (quote.length > 40 ? 1 : 0)
  );
}

const CAPTION =
  /\b((?:United States|State(?: of [A-Z][a-z]+)?) v\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s+v\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4})/;

/** Case name from a PACER or reporter title; falls back to a short title. */
export function caseCaption(title: string, summary = ''): string {
  const fromTitle = title.match(CAPTION);
  if (fromTitle) return fromTitle[1].replace(/\s+/g, ' ').trim();
  const fromSummary = summary.match(CAPTION);
  if (fromSummary) return fromSummary[1].replace(/\s+/g, ' ').trim();
  if (/UNITED STATES DISTRICT COURT/i.test(title)) {
    const docket = title.match(
      /\b(?:Case\s+)?No\.?\s*[:#]?\s*[\d:-]+[A-Za-z0-9-]*/i,
    );
    return docket
      ? `Federal court record ${docket[0]}`
      : 'Federal court record';
  }
  return short(title, 90);
}

function courtDocumentSection(record: WebRecord): RoutedSectionId | null {
  const text = `${record.title} ${record.url} ${record.summary}`.toLowerCase();
  // A title that opens with "Order on motion…" is an order, not a motion.
  if (
    /^\W*(order|opinion|ruling|judgment|memorandum opinion)\b/i.test(
      record.title,
    )
  ) {
    return 'orders';
  }
  if (/\b(deposition|transcript)\b/.test(text)) return 'depositions';
  if (
    /\b(motion|memorandum|complaint|petition|brief|affidavit|response in|reply)\b/.test(
      text,
    )
  ) {
    return 'pleadings';
  }
  if (
    /\b(order|opinion|ruling|judgment|report and recommendation)\b/.test(text)
  ) {
    return 'orders';
  }
  return null;
}

/** Everything the web run found, filed by report section. */
export function routeWebFindings(
  dossier: WebResearchDossier | null | undefined,
): Map<RoutedSectionId, RoutedFinding[]> {
  const routed = new Map<RoutedSectionId, RoutedFinding[]>();
  if (!dossier) return routed;
  const verifications = dossier.verifications ?? [];
  const verificationFor = (
    section: RoutedSectionId,
  ): WebVerification | null => {
    const topic = SECTION_VERIFICATION[section];
    return topic
      ? (verifications.find((v) => v.topic === topic) ?? null)
      : null;
  };
  const seen = new Set<string>();
  const push = (finding: RoutedFinding) => {
    const key = `${finding.sectionId}|${finding.url}|${(finding.quote ?? finding.statement).toLowerCase().slice(0, 120)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = routed.get(finding.sectionId) ?? [];
    list.push(finding);
    routed.set(finding.sectionId, list);
  };

  const orgs = new Map<
    string,
    { label: string; findings: RoutedFinding[]; pages: Set<string> }
  >();

  for (const record of dossier.records) {
    if (!tied(record)) continue;
    const matchLevel = record.match.level;
    const base = {
      url: record.url,
      sourceTitle: record.title,
      matchLevel,
      retrievedAt: record.retrievedAt,
      publishedAt: record.publishedAt,
    };
    let claimedDocumentType = false;
    for (const claim of record.claims) {
      const basis = claim.basis ?? 'third_party';
      for (const sectionId of sectionsFor(claim)) {
        if (['order', 'pleading', 'deposition'].includes(claim.topic ?? '')) {
          claimedDocumentType = true;
        }
        if (sectionId === 'university-accreditation') {
          const names = institutionsIn(`${claim.text} ${claim.quote}`);
          if (names.length === 0) continue;
          push({
            ...base,
            sectionId,
            title: `Institution named: ${names.join('; ')}`,
            statement: `The page names ${names.join('; ')} in connection with the expert’s education. Whether the institution is accredited was not checked against an accreditor’s list; no page read states it.`,
            quote: claim.quote,
            basis,
            basisLabel: BASIS_LABEL[basis],
            from: claim.from ?? 'page',
            verification: null,
          });
          continue;
        }
        if (sectionId === 'certification-orgs') {
          const official = officialSourceFor(record.url);
          for (const org of organizationsIn(`${claim.text} ${claim.quote}`)) {
            // A page is the primary source only for its own organization:
            // the AACN directory does not issue an ABPP certificate.
            const orgBasis: WebClaimBasis =
              basis === 'primary_source' &&
              !(org.acronym && official?.acronyms?.includes(org.acronym))
                ? 'third_party'
                : basis;
            const entry = orgs.get(org.key) ?? {
              label: org.label,
              findings: [],
              pages: new Set<string>(),
            };
            entry.pages.add(record.url);
            entry.findings.push({
              ...base,
              sectionId,
              title: org.label,
              statement: claim.text,
              quote: claim.quote,
              basis: orgBasis,
              basisLabel: BASIS_LABEL[orgBasis],
              from: claim.from ?? 'page',
              verification: verificationFor(sectionId),
            });
            orgs.set(org.key, entry);
          }
          continue;
        }
        const legal = LEGAL_SECTIONS.has(sectionId);
        push({
          ...base,
          sectionId,
          title: legal
            ? caseCaption(record.title, record.summary)
            : `${TOPIC_LABEL[claim.topic ?? 'other']}: ${short(record.title, 90)}`,
          statement: claim.text,
          quote: claim.quote,
          basis,
          basisLabel: BASIS_LABEL[basis],
          from: claim.from ?? 'page',
          verification: verificationFor(sectionId),
        });
      }
    }

    // An official listing page counts for its own sections even when no
    // sentence on it matched a rule.
    const official = officialSourceFor(record.url);
    if (official && record.read === 'read') {
      for (const topic of official.topics) {
        if (topic !== 'certification_org' && topic !== 'board_certification')
          continue;
        const entry = orgs.get(official.id.toUpperCase()) ?? {
          label: official.name,
          findings: [],
          pages: new Set<string>(),
        };
        entry.pages.add(record.url);
        entry.findings.push({
          ...base,
          sectionId: 'certification-orgs',
          title: official.name,
          statement: `${official.name} page that names the expert.`,
          quote: record.match.quote,
          basis: 'primary_source',
          basisLabel: BASIS_LABEL.primary_source,
          from: 'page',
          verification: verificationFor('certification-orgs'),
        });
        orgs.set(official.id.toUpperCase(), entry);
        break;
      }
    }

    // A journal or repository page that names the expert is a publication
    // record even when no single sentence matched a publication rule.
    if (
      record.kind === 'publication' &&
      !record.claims.some((claim) => claim.topic === 'publication')
    ) {
      push({
        ...base,
        sectionId: 'publications',
        title: short(record.title, 140),
        statement: record.summary,
        quote: record.match.quote,
        basis: 'record',
        basisLabel: BASIS_LABEL.record,
        from: record.read === 'read' ? 'page' : 'snippet',
        verification: verificationFor('publications'),
      });
    }

    // Court pages: file by document type when no statement already did.
    if (
      (record.kind === 'court' || record.kind === 'justia') &&
      !claimedDocumentType
    ) {
      const sectionId = courtDocumentSection(record);
      if (sectionId) {
        push({
          ...base,
          sectionId,
          title: caseCaption(record.title, record.summary),
          statement: record.summary,
          quote: record.match.quote,
          basis: 'record',
          basisLabel: BASIS_LABEL.record,
          from: record.read === 'read' ? 'page' : 'snippet',
          verification: null,
        });
      }
    }

    if (record.kind === 'social') {
      const institutional = /\/company\/|\/school\//i.test(record.url);
      const platform = record.platform
        ? record.platform.replace(/^./, (c) => c.toUpperCase())
        : 'Social';
      push({
        ...base,
        sectionId: 'social',
        title: institutional
          ? `Institutional ${platform} page listed in search`
          : record.platform
            ? `${platform} profile`
            : short(record.title, 90),
        statement: institutional
          ? 'A search result listed this as an official or employer social account connected to the expert’s work. It is not a personal profile of the expert. The page was not opened because it is shown only to signed-in users.'
          : record.read === 'read'
            ? record.summary
            : 'A search result listed this profile. The page was not opened because it is shown only to signed-in users.',
        quote: record.match.quote ?? record.snippet,
        basis: 'record',
        basisLabel: BASIS_LABEL.record,
        from: record.read === 'read' ? 'page' : 'snippet',
        verification: null,
      });
    }
  }

  // One entry per certification organization, however many pages name it.
  for (const entry of orgs.values()) {
    const ordered = [...entry.findings].sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        strength(b.quote) - strength(a.quote),
    );
    const lead = ordered[0];
    const others = [...entry.pages].filter((url) => url !== lead.url);
    push({
      ...lead,
      statement:
        others.length > 0
          ? `Named on ${entry.pages.size} pages. ${lead.statement}`
          : lead.statement,
      title: entry.label,
    });
    for (const url of others.slice(0, 5)) {
      const extra = ordered.find((f) => f.url === url);
      if (extra) push({ ...extra, title: `${entry.label} (also named here)` });
    }
  }

  // Businesses named on pages that name the expert.
  const companyNames = new Set<string>();
  for (const tie of dossier.companies ?? []) {
    const key = tie.name.toLowerCase();
    const record = dossier.records.find((r) => r.url === tie.url) ?? null;
    const first = !companyNames.has(key);
    companyNames.add(key);
    if (!first && tie.scope !== 'own_page') continue;
    push({
      sectionId: 'corporate',
      title: tie.name,
      statement:
        tie.scope === 'own_page'
          ? `${tie.name} is named with the expert on the expert’s own page (${hostOf(tie.url)}). The role (owner, officer, employer) is not stated unless the quote says so.`
          : `${tie.name} is named near the expert’s name on ${hostOf(tie.url)}. The page does not establish ownership or role.`,
      quote: tie.quote,
      url: tie.url,
      sourceTitle: record?.title ?? hostOf(tie.url),
      basis: tie.scope === 'own_page' ? 'subject_stated' : 'third_party',
      basisLabel:
        BASIS_LABEL[
          tie.scope === 'own_page' ? 'subject_stated' : 'third_party'
        ],
      matchLevel: (record?.match.level as 'strong' | 'possible') ?? 'possible',
      from: 'page',
      retrievedAt: record?.retrievedAt ?? dossier.ranAt,
      publishedAt: record?.publishedAt ?? null,
      verification: null,
    });
  }

  for (const [sectionId, list] of routed) {
    // One entry per page in a section: the strongest statement from it.
    const byPage = new Map<string, RoutedFinding>();
    const perPage = ONE_PER_PAGE.has(sectionId);
    for (const finding of list) {
      const key = perPage
        ? finding.url
        : `${finding.url}|${finding.title}|${finding.quote}`;
      const kept = byPage.get(key);
      if (!kept || strength(finding.quote) > strength(kept.quote)) {
        byPage.set(key, finding);
      }
    }
    list.splice(0, list.length, ...byPage.values());
    list.sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        (a.from === b.from ? 0 : a.from === 'page' ? -1 : 1) ||
        strength(b.quote) - strength(a.quote) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
    );
    routed.set(sectionId, list.slice(0, 12));
  }
  return routed;
}

/** What each routed section looks for, and which targeted searches fed it. */
const SECTION_SEARCH: Record<
  RoutedSectionId,
  { what: string; topics: readonly string[] }
> = {
  background: { what: 'employment or practice history', topics: ['identity'] },
  education: { what: 'a degree or training', topics: ['education'] },
  'university-accreditation': {
    what: 'a degree-granting institution',
    topics: [],
  },
  licenses: { what: 'a professional license', topics: ['license'] },
  'board-actions': {
    what: 'a licensing board action or complaint',
    topics: ['discipline'],
  },
  'board-certifications': {
    what: 'a board certification',
    topics: ['certification', 'certification_org'],
  },
  'certification-orgs': {
    what: 'a certifying or listing organization',
    topics: ['certification_org', 'certification'],
  },
  memberships: { what: 'a professional membership', topics: ['memberships'] },
  publications: { what: 'a publication', topics: ['publications'] },
  grants: { what: 'a research grant', topics: ['grants'] },
  patents: { what: 'a patent or trademark', topics: ['patents'] },
  'awards-military': {
    what: 'an award, honor or military service',
    topics: ['awards'],
  },
  ime: {
    what: 'IME or expert-services advertising',
    topics: ['ime', 'advertising', 'directories'],
  },
  orders: {
    what: 'a court order naming the expert',
    topics: ['court_documents', 'litigation'],
  },
  pleadings: {
    what: 'a motion or pleading naming the expert',
    topics: ['court_documents', 'litigation'],
  },
  depositions: {
    what: 'a deposition or testimony transcript',
    topics: ['depositions'],
  },
  'testimony-inconsistencies': {
    what: 'testimony or a transcript to compare',
    topics: ['depositions', 'litigation'],
  },
  'income-bias': {
    what: 'fees, rates or retention figures',
    topics: ['ime', 'advertising'],
  },
  lawsuits: {
    what: 'a lawsuit or malpractice claim',
    topics: ['litigation', 'discipline'],
  },
  criminal: { what: 'a criminal record', topics: ['criminal'] },
  corporate: { what: 'a business tie', topics: ['business'] },
  'patient-reviews': {
    what: 'a patient or client review',
    topics: ['reviews'],
  },
  'office-location': {
    what: 'an office address',
    topics: ['places'],
  },
  'admissibility-challenges': {
    what: 'a Daubert, Frye or Rule 702 challenge',
    topics: ['litigation', 'court_documents'],
  },
  'university-rules': {
    what: 'a university rule or policy that applies to the expert',
    topics: ['university_rules'],
  },
  websites: { what: 'an expert or practice website', topics: ['identity'] },
  directories: {
    what: 'an expert directory listing',
    topics: ['directories'],
  },
  social: { what: 'a social media profile', topics: ['social'] },
  videos: { what: 'a video, podcast or transcript', topics: ['video'] },
  news: {
    what: 'a news article or blog post',
    topics: ['news', 'news_adverse'],
  },
};

export function sectionVerification(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
): WebVerification | null {
  if (!dossier || !isRoutedSection(sectionId)) return null;
  const topic = SECTION_VERIFICATION[sectionId];
  return topic
    ? ((dossier.verifications ?? []).find((v) => v.topic === topic) ?? null)
    : null;
}

const NOT_SEARCHED = 'This was not searched in this investigation.';
const SEARCH_INCOMPLETE =
  'The search for this topic did not complete, so no finding is reported.';
const TOPIC_UNVERIFIED =
  'A web search included this topic. No dedicated source for this category was searched, so it remains unverified.';

function blockedNote(
  dossier: WebResearchDossier,
  sectionId: RoutedSectionId,
): string | null {
  const hosts: Partial<Record<RoutedSectionId, RegExp>> = {
    publications: /researchgate\.net|pubmed|pmc\.ncbi/i,
    grants: /reporter\.nih\.gov|researchgate\.net/i,
    licenses: /doh\.state\.fl\.us|flhealthsource/i,
    patents: /uspto\.gov|patents\.google/i,
  };
  const pattern = hosts[sectionId];
  if (!pattern) return null;
  const hit = dossier.pagesBlocked.find((page) => pattern.test(page.url));
  if (!hit) return null;
  return 'A source that may hold information for this section could not be read (login, bot protection or robots.txt).';
}

function webRunAttempted(dossier: WebResearchDossier): boolean {
  return dossier.providers.some((provider) => provider.requests > 0);
}

function webRunWorked(dossier: WebResearchDossier): boolean {
  return dossier.providers.some(
    (provider) =>
      provider.requests > 0 && provider.failedRequests < provider.requests,
  );
}

function topicQueriesForSection(
  dossier: WebResearchDossier,
  sectionId: RoutedSectionId,
): number {
  if (!dossier.topics) return 0;
  const wanted = SECTION_SEARCH[sectionId].topics;
  return dossier.topics
    .filter((entry) => wanted.includes(entry.topic))
    .reduce((sum, entry) => sum + entry.queries, 0);
}

/**
 * Empty-section copy. A global web run is not treated as a search of every
 * category. Dedicated source lines (structured) speak for themselves.
 */
export function coverageLine(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
  structured: string[] = [],
  expertName?: string,
): string {
  void expertName;
  if (!isRoutedSection(sectionId)) {
    return structured.length > 0 ? structured.join(' ') : NOT_SEARCHED;
  }
  const parts: string[] = [];
  const attempted = Boolean(dossier && webRunAttempted(dossier));
  const worked = Boolean(dossier && webRunWorked(dossier));
  const queried =
    !!dossier && worked && topicQueriesForSection(dossier, sectionId) > 0;
  if (attempted && !worked) {
    parts.push(SEARCH_INCOMPLETE);
  } else if (structured.length === 0) {
    parts.push(queried ? TOPIC_UNVERIFIED : NOT_SEARCHED);
  }
  if (dossier) {
    const blocked = blockedNote(dossier, sectionId);
    if (blocked) parts.push(blocked);
  }
  parts.push(...structured);
  return parts.join(' ');
}
