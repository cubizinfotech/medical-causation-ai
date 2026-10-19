import { fetchJson } from './live-http';
import { mapWithLimit } from './live-provider.base';
import type { OpenAlexClient, OpenAlexWork } from './openalex.client';
import { authorListed } from './pubmed.provider';
import { namesCompatible, parsePersonName, type PersonName } from './person-name';

/**
 * authored: found, and the expert is among the authors.
 * not_author: a work with this title exists, but the expert is not an author.
 * not_found: no work with this title in OpenAlex (it may be in a source
 *   OpenAlex does not index).
 * unavailable: the lookup could not run.
 */
export type PublicationLookupStatus =
  'authored' | 'not_author' | 'not_found' | 'unavailable';

export interface PublicationLookupResult {
  title: string;
  status: PublicationLookupStatus;
  /** Which catalog produced the match. Absent when nothing was found. */
  catalog?: 'OpenAlex' | 'PubMed';
  work?: {
    title: string;
    url: string;
    year: number | null;
    authors: string[];
  };
}

export interface PubMedTitleLookupOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  email?: string;
}

const MAX_TITLES = 40;

/**
 * The article title inside a CV citation such as
 * "Hanlon RE, Demery JA (1998). Axial movements are relatively preserved. Cortex".
 * A title that is already just the article name is returned unchanged.
 */
export function articleTitle(citation: string): string {
  const match = citation.match(
    /\((?:19|20)\d{2}[a-z]?\)\.\s*([^.]{12,240})/,
  );
  const title = (match?.[1] ?? citation).replace(/\s+/g, ' ').trim();
  return title;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 1);
}

/**
 * Same title despite punctuation, case, and a missing subtitle: most words
 * shared both ways, or one title contained in the other.
 */
export function sameTitle(left: string, right: string): boolean {
  const a = tokens(left);
  const b = tokens(right);
  if (a.length < 3 || b.length < 3) return a.join(' ') === b.join(' ');
  const joinedA = a.join(' ');
  const joinedB = b.join(' ');
  const [shorter, longer] =
    joinedA.length <= joinedB.length ? [joinedA, joinedB] : [joinedB, joinedA];
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) {
    return true;
  }
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  return shared / Math.max(a.length, b.length) >= 0.85;
}

/** Checks titles a CV lists against OpenAlex and its author lists. */
export class PublicationTitleLookup {
  constructor(
    private readonly client: OpenAlexClient,
    private readonly pubmed?: PubMedTitleLookupOptions,
  ) {}

  async lookup(
    expertName: string,
    titles: string[],
  ): Promise<PublicationLookupResult[]> {
    const expert = parsePersonName(expertName);
    const unique = [...new Set(titles.map((title) => title.trim()))]
      .filter((title) => tokens(title).length >= 3)
      .slice(0, MAX_TITLES);
    return mapWithLimit(unique, 3, async (title) => {
      const phrase = articleTitle(title);
      try {
        const works = await this.client.searchWorks(phrase);
        const match = works.find(
          (work) => work.title && sameTitle(phrase, work.title),
        );
        if (match) {
          const authors = (match.authorships ?? [])
            .map((authorship) => authorship.author?.display_name)
            .filter((name): name is string => Boolean(name));
          const authored = authors.some((author) => {
            const parsed = parsePersonName(author);
            return Boolean(expert && parsed && namesCompatible(parsed, expert));
          });
          return {
            title,
            catalog: 'OpenAlex' as const,
            status: authored ? ('authored' as const) : ('not_author' as const),
            work: describeWork(match, authors),
          };
        }
      } catch {
        const fromPubMed = expert
          ? await this.pubMedWork(phrase, expert)
          : null;
        if (fromPubMed) {
          return { title, catalog: 'PubMed' as const, status: 'authored' as const, work: fromPubMed };
        }
        return { title, status: 'unavailable' as const };
      }
      if (!expert) return { title, status: 'not_found' as const };
      const fromPubMed = await this.pubMedWork(phrase, expert);
      if (fromPubMed) {
        return { title, catalog: 'PubMed' as const, status: 'authored' as const, work: fromPubMed };
      }
      return { title, status: 'not_found' as const };
    });
  }

  private async pubMedWork(
    phrase: string,
    expert: PersonName,
  ): Promise<NonNullable<PublicationLookupResult['work']> | null> {
    if (!this.pubmed) return null;
    try {
      const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
      const search = new URL(`${base}/esearch.fcgi`);
      search.searchParams.set('db', 'pubmed');
      search.searchParams.set('retmode', 'json');
      search.searchParams.set('retmax', '3');
      search.searchParams.set('tool', 'medical-causation-ai');
      if (this.pubmed.email) search.searchParams.set('email', this.pubmed.email);
      if (this.pubmed.apiKey) search.searchParams.set('api_key', this.pubmed.apiKey);
      search.searchParams.set(
        'term',
        `${phrase}[Title] AND ${expert.last}[Author]`,
      );
      const found = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(
        search,
        { timeoutMs: this.pubmed.timeoutMs, fetchImpl: this.pubmed.fetchImpl },
      );
      const pmid = found.esearchresult?.idlist?.[0];
      if (!pmid) return null;
      const summary = new URL(`${base}/esummary.fcgi`);
      summary.searchParams.set('db', 'pubmed');
      summary.searchParams.set('retmode', 'json');
      summary.searchParams.set('id', pmid);
      summary.searchParams.set('tool', 'medical-causation-ai');
      const payload = await fetchJson<{
        result?: Record<
          string,
          { title?: string; pubdate?: string; authors?: Array<{ name?: string }> }
        >;
      }>(summary, {
        timeoutMs: this.pubmed.timeoutMs,
        fetchImpl: this.pubmed.fetchImpl,
      });
      const article = payload.result?.[pmid];
      const authors = (article?.authors ?? [])
        .map((author) => author.name)
        .filter((name): name is string => Boolean(name));
      if (!authors.some((author) => authorListed(author, expert))) return null;
      if (article?.title && !sameTitle(phrase, article.title)) return null;
      return {
        title: article?.title ?? phrase,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        year: article?.pubdate ? Number(article.pubdate.slice(0, 4)) || null : null,
        authors: authors.slice(0, 8),
      };
    } catch {
      return null;
    }
  }
}

function describeWork(
  work: OpenAlexWork,
  authors: string[],
): NonNullable<PublicationLookupResult['work']> {
  return {
    title: work.title ?? '',
    url: work.doi ?? work.id,
    year: work.publication_year ?? null,
    authors: authors.slice(0, 8),
  };
}
