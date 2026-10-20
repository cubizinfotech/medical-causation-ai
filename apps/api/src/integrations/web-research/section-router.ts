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
        push({
          ...base,
          sectionId,
          title: `${TOPIC_LABEL[claim.topic ?? 'other']}: ${short(record.title, 90)}`,
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
          title: short(record.title, 120),
          statement: record.summary,
          quote: record.match.quote,
          basis: 'record',
          basisLabel: BASIS_LABEL.record,
          from: record.read === 'read' ? 'page' : 'snippet',
          verification: null,
        });
      }
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
    topics: ['education'],
  },
  licenses: { what: 'a professional license', topics: ['license'] },
  'board-actions': {
    what: 'a licensing board action or complaint',
    topics: ['discipline', 'license'],
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
  criminal: { what: 'a criminal record', topics: ['discipline'] },
  corporate: { what: 'a business tie', topics: ['business'] },
  'patient-reviews': {
    what: 'a patient or client review',
    topics: ['reviews'],
  },
  'office-location': {
    what: 'an office address',
    topics: ['places', 'identity'],
  },
  'admissibility-challenges': {
    what: 'a Daubert, Frye or Rule 702 challenge',
    topics: ['litigation', 'court_documents'],
  },
  'university-rules': {
    what: 'a university rule or policy that applies to the expert',
    topics: ['education'],
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

/**
 * The line that replaces "nothing was confirmed" in a section with no finding.
 * It says what was searched and what limited the search, so "not found" and
 * "not reachable" are not the same sentence.
 */
export function coverageLine(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
  structured: string[] = [],
): string {
  if (!isRoutedSection(sectionId)) {
    return 'No page or source in this run stated this for the expert. A search cannot prove that nothing exists.';
  }
  const { what, topics } = SECTION_SEARCH[sectionId];
  const parts: string[] = [];
  if (!dossier) {
    parts.push(
      `The web search did not run for this investigation, so ${what} was not searched for on the web.`,
    );
  } else {
    const worked = dossier.providers.some(
      (p) => p.requests > 0 && p.failedRequests < p.requests,
    );
    if (!worked) {
      parts.push(
        `The web search did not complete, so ${what} was not searched for. This is not a finding that none exists.`,
      );
    } else if (dossier.topics) {
      const stats = dossier.topics.filter((t) => topics.includes(t.topic));
      const queries = stats.reduce((sum, t) => sum + t.queries, 0);
      const hits = stats.reduce((sum, t) => sum + t.hits, 0);
      parts.push(
        queries > 0
          ? `${queries} targeted web search${queries === 1 ? '' : 'es'} looked for ${what} and returned ${hits} page${hits === 1 ? '' : 's'}; none of the pages tied to this expert stated one.`
          : `No targeted web search for ${what} completed in this run.`,
      );
    } else {
      parts.push(
        `The web research did not record a targeted search for ${what}; no page tied to this expert stated one.`,
      );
    }
    if (dossier.pagesBlocked.length > 0) {
      parts.push(
        `${dossier.pagesBlocked.length} page${dossier.pagesBlocked.length === 1 ? '' : 's'} that may concern the expert could not be read (login, bot protection or robots.txt) and may hold information for this section; they are listed in section 39.`,
      );
    }
  }
  parts.push(...structured);
  parts.push('A search cannot prove that nothing exists.');
  return parts.join(' ');
}
