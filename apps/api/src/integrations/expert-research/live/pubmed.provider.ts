import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { fetchJson } from './live-http';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { parsePersonName, type PersonName } from './person-name';

const MAX_ARTICLES = 12;
const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface PubMedAuthor {
  name?: string;
}

interface PubMedSummary {
  uid?: string;
  title?: string;
  pubdate?: string;
  fulljournalname?: string;
  source?: string;
  authors?: PubMedAuthor[];
}

/**
 * PubMed author search. An article is kept only when an author string matches
 * the expert’s last name and first initial (and middle initial when both
 * sides have one). The summary does not prove affiliation.
 */
export class PubMedResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly fetchImpl: typeof fetch | undefined,
    private readonly timeoutMs: number,
    private readonly apiKey?: string,
    private readonly email?: string,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const name = parsePersonName(query.expertName);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. PubMed needs the expert’s first and last name.',
      };
    }
    const ids = await this.searchIds(name);
    if (ids.length === 0) {
      return {
        items: [],
        message: `PubMed has no articles whose author name matches ${name.last} ${name.first[0].toUpperCase()}.`,
      };
    }
    const summaries = await this.summaries(ids);
    const items = summaries
      .filter((article) =>
        (article.authors ?? []).some((author) =>
          authorListed(author.name ?? '', name),
        ),
      )
      .slice(0, MAX_ARTICLES)
      .map((article) => this.articleItem(article, name, retrievedAt));
    if (items.length === 0) {
      return {
        items: [],
        message: `PubMed returned ${ids.length} id(s) for ${name.last}, but none of the author lists matched the expert’s initials. Nothing was attributed.`,
      };
    }
    return {
      items,
      message: `${items.length} PubMed article(s) list an author matching ${name.last} and the expert’s initials. Affiliation was not confirmed from the PubMed summary.`,
    };
  }

  private async searchIds(name: PersonName): Promise<string[]> {
    const initials = `${name.first[0]}${name.middle[0]?.[0] ?? ''}`;
    const url = this.endpoint('esearch.fcgi', {
      term: `${name.last} ${initials}[Author]`,
      retmax: String(MAX_ARTICLES),
      sort: 'pub_date',
    });
    const payload = await fetchJson<{
      esearchresult?: { idlist?: string[]; ERROR?: string };
    }>(url, { timeoutMs: this.timeoutMs, fetchImpl: this.fetchImpl });
    if (payload.esearchresult?.ERROR) {
      throw new Error(payload.esearchresult.ERROR);
    }
    return payload.esearchresult?.idlist ?? [];
  }

  private async summaries(ids: string[]): Promise<PubMedSummary[]> {
    const url = this.endpoint('esummary.fcgi', { id: ids.join(',') });
    const payload = await fetchJson<{
      result?: { uids?: string[] } & Record<string, PubMedSummary>;
    }>(url, { timeoutMs: this.timeoutMs, fetchImpl: this.fetchImpl });
    return (payload.result?.uids ?? [])
      .map((uid) => payload.result?.[uid])
      .filter((record): record is PubMedSummary => Boolean(record?.title));
  }

  private endpoint(path: string, params: Record<string, string>): URL {
    const url = new URL(`${PUBMED_BASE}/${path}`);
    url.searchParams.set('db', 'pubmed');
    url.searchParams.set('retmode', 'json');
    url.searchParams.set('tool', 'medical-causation-ai');
    if (this.email) url.searchParams.set('email', this.email);
    if (this.apiKey) url.searchParams.set('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url;
  }

  private articleItem(
    article: PubMedSummary,
    name: PersonName,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const pmid = article.uid ?? '';
    const authors = (article.authors ?? [])
      .map((author) => author.name)
      .filter((value): value is string => Boolean(value));
    const journal = article.fulljournalname || article.source || 'journal not listed';
    const year = article.pubdate?.slice(0, 4);
    return this.item({
      category: 'publication',
      title: article.title ?? 'Untitled PubMed article',
      summary: [
        `PubMed lists “${article.title}”`,
        year ? `(${year})` : null,
        `in ${journal}.`,
        authors.length > 0 ? `Authors: ${authors.join(', ')}.` : null,
        `An author string matches ${name.last} and the expert’s initials.`,
        'This summary does not confirm the author’s institution, so it is not proof the article belongs to this expert.',
      ]
        .filter(Boolean)
        .join(' '),
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
      retrievedAt,
      informationStatus: 'unverified',
      raw: { pmid, authors, journal, pubdate: article.pubdate ?? null },
    });
  }
}

/** "Demery JA" and "Demery, Jason A" match; "Demery JB" does not. */
export function authorListed(author: string, name: PersonName): boolean {
  const tokens = author
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.includes(name.last)) return false;
  const rest = tokens.filter((token) => token !== name.last).join('');
  if (!rest.startsWith(name.first[0])) return false;
  if (rest.startsWith(name.first)) return true;
  const middle = name.middle[0]?.[0];
  if (middle && rest.length >= 2) return rest[1] === middle;
  return true;
}
