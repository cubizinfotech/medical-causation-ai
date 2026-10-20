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
  WEB_RESEARCH_SOURCE_IDS,
  WEB_SOURCE_LABEL as SOURCE_LABEL,
} from './source-kind';
import type { WebResearchEngine } from './web-research-engine';
import type { WebRecord, WebResearchDossier } from './web-research.types';

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
      },
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

    if (!attempted || !worked) {
      return {
        items: [],
        status: 'unavailable',
        outcome: 'unavailable',
        message: !attempted
          ? `Not searched: no web search provider is configured. This is not a finding that no ${label} exist.`
          : `Not searched: every web search request failed (${dossier.providers
              .flatMap((p) => p.failures)
              .slice(0, 2)
              .map((f) => f.message)
              .join(' ')}). This is not a finding that no ${label} exist.`,
      };
    }

    const records = dossier.records.filter((r) => sourceIdForRecord(r) === id);
    const items = records.map((record) =>
      itemFor(this.definition, record, query, retrievedAt),
    );
    const tied = records.filter(
      (r) => r.match.level === 'strong' || r.match.level === 'possible',
    );

    if (id === 'web_search') {
      items.unshift(summaryItem(this.definition, dossier, query, retrievedAt));
    }

    if (items.length === 0) {
      return {
        items: [],
        message: `Searched ${searchedBy}. No ${label} that name ${query.expertName} were found in the results returned${dossier.partial ? ' (the run was cut short, so this is incomplete)' : ''}. A search cannot prove that none exist.`,
      };
    }
    const unconfirmed = records.length - tied.length;
    return {
      items,
      message:
        records.length === 0
          ? `Web research summary from ${searchedBy}.`
          : `${tied.length} ${label} matched to ${query.expertName}${unconfirmed > 0 ? `; ${unconfirmed} more name the same name but are not attributed to this person` : ''}. Found by ${searchedBy}.`,
    };
  }
}

function summaryItem(
  definition: ProviderDefinition,
  dossier: WebResearchDossier,
  query: ExpertResearchQuery,
  retrievedAt: string,
): ExpertEvidenceItem {
  const subjectRecords = dossier.records.filter(
    (r) => r.match.level === 'strong' || r.match.level === 'possible',
  );
  const byKind = new Map<string, number>();
  for (const record of subjectRecords) {
    byKind.set(record.kind, (byKind.get(record.kind) ?? 0) + 1);
  }
  const kinds = [...byKind.entries()].map(([k, n]) => `${n} ${k}`).join(', ');
  const others = dossier.candidates.filter((c) => c.role === 'other');
  return {
    sourceId: definition.id,
    category: 'web',
    title: 'Web research coverage',
    summary: `${dossier.queriesRun} searches across ${describeSearchProviders(dossier)}; ${dossier.pagesRead} pages read; ${subjectRecords.length} pages matched to the subject${kinds ? ` (${kinds})` : ''}; ${others.length} other same-name candidate group${others.length === 1 ? '' : 's'} kept separate; ${dossier.pagesBlocked.length} page${dossier.pagesBlocked.length === 1 ? '' : 's'} could not be read.`,
    simulated: false,
    access: 'public',
    informationStatus: 'unverified',
    retrievedAt,
    source: {
      providerId: definition.id,
      name: definition.name,
      retrievedAt,
      access: 'public',
    },
    raw: {
      identity: { name: query.expertName, verifiedBy: 'source_match' },
      webSummary: {
        queriesRun: dossier.queriesRun,
        pagesRead: dossier.pagesRead,
        partial: dossier.partial,
        limitations: dossier.limitations,
      },
    },
  };
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
