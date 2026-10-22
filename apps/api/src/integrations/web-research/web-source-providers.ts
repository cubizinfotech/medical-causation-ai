import type {
  ExpertEvidenceItem,
  ExpertResearchProviderId,
  ExpertResearchQuery,
  IExpertResearchProvider,
  ProviderDefinition,
} from '../expert-research/expert-research.types';
import {
  LiveResearchProvider,
  type LiveRunResult,
} from '../expert-research/live/live-provider.base';
import {
  catalogSourceFor,
  classifyUrl,
  WEB_RESEARCH_SOURCE_IDS,
  WEB_SOURCE_LABEL as SOURCE_LABEL,
} from './source-kind';
import type { WebResearchEngine } from './web-research-engine';
import type {
  WebBlockedPage,
  WebRecord,
  WebResearchDossier,
} from './web-research.types';

/** Hosts that count as a dedicated search of a named directory. */
export const DEDICATED_DIRECTORY_HOSTS: Record<string, string[]> = {
  seak: ['seakexperts.com', 'seak.com'],
  dri: ['dri.org'],
  alm_law: ['almexperts.com'],
  jurispro: ['jurispro.com'],
  expertlaw: ['expertlaw.com'],
  expertpages: ['expertpages.com'],
  expertwitness_com: ['expertwitness.com'],
};

/** Query-planner topics that count as a dedicated search of a catalog source. */
export const DEDICATED_SOURCE_TOPICS: Record<string, string[]> = {
  web_search: ['identity'],
  news: ['news', 'news_adverse'],
  blogs: ['news'],
  social: ['social'],
  expert_directory: ['directories'],
  other_expert_directories: ['directories'],
  expert_website: ['identity'],
  ime_websites: ['ime'],
  advertising: ['advertising'],
  ime_advertising: ['advertising', 'ime'],
  other_public_websites: ['identity'],
  youtube: ['video'],
  presentations: ['video'],
  powerpoints: ['video'],
  patient_reviews: ['reviews'],
  google_maps: ['places'],
  corporate_affiliations: ['business'],
  university: ['education', 'university_rules'],
  state_court_records: ['litigation', 'court_documents'],
};

/**
 * A named directory is searched only when its host appeared in a query or
 * result. A generic "directories" topic is not a SEAK or JurisPro search.
 */
export function dedicatedSearchRan(
  sourceId: string,
  dossier: WebResearchDossier,
): boolean {
  const hosts = DEDICATED_DIRECTORY_HOSTS[sourceId];
  if (hosts) return haystackMentionsHost(dossier, hosts);
  const topics = DEDICATED_SOURCE_TOPICS[sourceId];
  if (!topics) return sourceId === 'web_search';
  return (dossier.topics ?? []).some(
    (entry) => topics.includes(entry.topic) && entry.queries > 0,
  );
}

function haystackMentionsHost(
  dossier: WebResearchDossier,
  hosts: string[],
): boolean {
  const hay = [
    ...dossier.records.flatMap((record) => record.queries),
    ...dossier.records.map((record) => record.url),
    ...dossier.pagesBlocked.map((page) => page.url),
    ...(dossier.executedQueries ?? []).map((entry) => entry.query),
  ]
    .join(' ')
    .toLowerCase();
  return hosts.some(
    (host) => hay.includes(host.toLowerCase()) || hay.includes(`site:${host}`),
  );
}

const PRACTICE_PAGE_KINDS = new Set([
  'expert_website',
  'advertising',
  'ime',
  'profile',
  'other',
]);

/**
 * A practice or IME page can also answer the advertising catalog sources
 * when the page itself markets forensic or expert-witness services. A
 * biography without that language stays a website, not an advertisement.
 */
export function recordServesCatalogSource(
  record: WebRecord,
  sourceId: string,
): boolean {
  if (!PRACTICE_PAGE_KINDS.has(record.kind)) return false;
  if (record.match.level !== 'strong' && record.match.level !== 'possible') {
    return false;
  }
  const claims = record.claims ?? [];
  const hay = [
    record.title,
    record.summary,
    ...claims.map((claim) => `${claim.type} ${claim.topic} ${claim.quote}`),
  ]
    .join(' ')
    .toLowerCase();
  const ime =
    /\bindependent medical\b|\bime\b|\bcompulsory examination\b|\brule 35\b|\bforensic evaluat/.test(
      hay,
    ) ||
    claims.some((claim) => claim.topic === 'ime' || claim.type === 'forensic');
  const ads =
    /\bexpert witness\b|\bavailable to attorneys\b|\bmedicolegal\b|\bforensic (?:neuro)?psycholog/.test(
      hay,
    ) ||
    claims.some(
      (claim) => claim.topic === 'advertising' || claim.type === 'advertising',
    );
  if (sourceId === 'ime_websites' || sourceId === 'ime_advertising') return ime;
  if (sourceId === 'advertising') return ads || ime;
  return false;
}

/** Catalog source a web record belongs to. */
export function sourceIdForRecord(record: WebRecord): string {
  if (record.place) return 'google_maps';
  return catalogSourceFor(record.kind, record.directoryId).sourceId;
}

function itemFor(
  definition: ProviderDefinition,
  record: WebRecord,
  query: ExpertResearchQuery,
  retrievedAt: string,
): ExpertEvidenceItem {
  const tied =
    record.match.level === 'strong' || record.match.level === 'possible';
  const mapped = catalogSourceFor(record.kind, record.directoryId);
  const caveat = !tied
    ? record.match.level === 'other_person'
      ? 'This page appears to concern a different person with a similar name. It is not attributed to the subject. '
      : 'This page names the same name, but nothing ties it to this person. It is not attributed to the subject. '
    : record.match.level === 'possible'
      ? 'Possible match: the profession, place or note details only partly agree. '
      : '';
  return {
    sourceId: definition.id,
    category: mapped.category,
    title: record.title,
    summary: `${caveat}${record.summary}`.trim(),
    url: record.url,
    simulated: false,
    access: 'public',
    informationStatus:
      record.match.level === 'strong' ? 'verified' : 'unverified',
    retrievedAt,
    source: {
      providerId: definition.id,
      name: definition.name,
      url: record.url,
      retrievedAt,
      access: 'public',
    },
    raw: {
      identity: {
        name: query.expertName,
        verifiedBy: tied ? 'source_match' : undefined,
        ambiguous: !tied,
        basis: record.match.basis,
        matchLevel: record.match.level,
      },
      documentType: record.kind,
      documentDate: record.publishedAt,
      retrievedAt,
      web: {
        recordId: record.id,
        kind: record.kind,
        platform: record.platform,
        match: record.match,
        read: record.read,
        readNote: record.readNote,
        publishedAt: record.publishedAt,
        claims: record.claims,
        candidateId: record.candidateId,
        rating: record.rating,
        place: record.place,
        searchProviders: record.searchProviders,
      },
    },
  };
}

export function describeSearchProviders(dossier: WebResearchDossier): string {
  const used = dossier.providers.filter((p) => p.requests > 0);
  return used.length > 0
    ? used.map((p) => p.name).join(', ')
    : 'no search provider';
}

/**
 * A catalog source answered from the shared web research run. Every source of
 * one investigation reads the same memoized dossier, so the web is searched
 * once, not once per source.
 */
export class WebSourceProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly engine: WebResearchEngine,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const dossier = await this.engine.research({
      expertName: query.expertName,
      city: query.city,
      specialty: query.specialty,
      npi: query.npi,
      context: query.context,
    });
    const id = this.definition.id;
    const label = SOURCE_LABEL[id] ?? 'web pages';
    const searchedBy = describeSearchProviders(dossier);
    const attempted = dossier.providers.some((p) => p.requests > 0);
    const worked = dossier.providers.some(
      (p) => p.requests > 0 && p.failedRequests < p.requests,
    );

    if (!attempted) {
      return {
        items: [],
        status: 'unavailable',
        outcome: 'not_configured',
        message: `Not searched: no web search provider is configured. This is not a finding that no ${label} exist.`,
      };
    }
    if (!worked) {
      const reason = dossier.providers
        .flatMap((p) => p.failures)
        .slice(0, 2)
        .map((f) => f.message)
        .filter(Boolean)
        .join(' ');
      return {
        items: [],
        status: 'error',
        outcome: 'api_failure',
        message: `Web search failed${reason ? ` (${reason})` : ''}. This is not a finding that no ${label} exist.`,
      };
    }

    const records = dossier.records.filter(
      (r) => sourceIdForRecord(r) === id || recordServesCatalogSource(r, id),
    );
    const blocked = blockedPagesForSource(dossier.pagesBlocked, id, records);
    const items = [
      ...records.map((record) =>
        itemFor(this.definition, record, query, retrievedAt),
      ),
      ...blocked.map((page) =>
        blockedItem(this.definition, page, query, retrievedAt),
      ),
    ];
    const tied = records.filter(
      (r) => r.match.level === 'strong' || r.match.level === 'possible',
    );

    if (records.length === 0 && blocked.length === 0) {
      if (!dedicatedSearchRan(id, dossier)) {
        return {
          items,
          status: 'skipped',
          outcome: 'unavailable',
          message: `A general web search ran. ${label} were not searched as a dedicated source. This is not a finding that none exist.`,
        };
      }
      return {
        items,
        status: 'no_result',
        outcome: 'no_result',
        message: `Searched ${searchedBy}. No ${label} that name ${query.expertName} were found in the results returned${dossier.partial ? ' (the run was cut short, so this is incomplete)' : ''}. A search cannot prove that none exist.${id === 'youtube' ? ' Video hits from other investigations are not reused or revalidated here.' : ''}`,
      };
    }
    const unconfirmed = records.length - tied.length;
    const unread = [
      ...records.filter((r) => r.read === 'restricted' || r.read === 'failed'),
      ...blocked,
    ].length;
    return {
      items,
      message: [
        `${tied.length} ${label} matched to ${query.expertName}`,
        unconfirmed > 0
          ? `; ${unconfirmed} more name the same name but are not attributed to this person`
          : '',
        unread > 0
          ? `; ${unread} page(s) could not be read and are listed as limitations`
          : '',
        `. Found by ${searchedBy}.`,
      ].join(''),
    };
  }
}

function blockedPagesForSource(
  pages: WebBlockedPage[],
  sourceId: string,
  records: WebRecord[],
): WebBlockedPage[] {
  const seen = new Set(records.map((record) => record.url.toLowerCase()));
  return pages.filter((page) => {
    if (seen.has(page.url.toLowerCase())) return false;
    const classified = classifyUrl(page.url, 'web');
    return (
      catalogSourceFor(classified.kind, classified.directoryId).sourceId ===
      sourceId
    );
  });
}

function blockedItem(
  definition: ProviderDefinition,
  page: WebBlockedPage,
  query: ExpertResearchQuery,
  retrievedAt: string,
): ExpertEvidenceItem {
  return {
    sourceId: definition.id,
    category: catalogSourceFor(classifyUrl(page.url, 'web').kind).category,
    title: `Page could not be read (${definition.name})`,
    summary: `${page.reason} The page was not treated as an empty successful search.`,
    url: page.url,
    simulated: false,
    access: 'public',
    informationStatus: 'unverified',
    retrievedAt,
    source: {
      providerId: definition.id,
      name: definition.name,
      url: page.url,
      retrievedAt,
      access: 'public',
    },
    raw: {
      identity: {
        name: query.expertName,
        ambiguous: true,
        basis: ['page blocked before identity could be confirmed'],
      },
      web: { read: 'restricted', readNote: page.reason },
    },
  };
}

/** Audit line for the shared web run; not a finding about the expert. */
export function isWebCoverageSummary(
  item: Pick<ExpertEvidenceItem, 'title' | 'raw'>,
): boolean {
  if (item.title === 'Web research coverage') return true;
  return Boolean(
    item.raw &&
    typeof item.raw === 'object' &&
    'webSummary' in item.raw &&
    (item.raw as { webSummary?: unknown }).webSummary,
  );
}

/** One provider per catalog source the web layer answers. */
export function createWebSourceProviders(
  definitions: readonly ProviderDefinition[],
  engine: WebResearchEngine,
): Map<ExpertResearchProviderId, IExpertResearchProvider> {
  const providers = new Map<
    ExpertResearchProviderId,
    IExpertResearchProvider
  >();
  const wanted = new Set<string>(WEB_RESEARCH_SOURCE_IDS);
  for (const definition of definitions) {
    if (wanted.has(definition.id)) {
      providers.set(definition.id, new WebSourceProvider(definition, engine));
    }
  }
  return providers;
}
