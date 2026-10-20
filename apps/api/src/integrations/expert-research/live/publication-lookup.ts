import { fetchJson } from './live-http';
import { mapWithLimit } from './live-provider.base';
import {
  authorPositionIn,
  parseCitationAuthors,
  type AuthorPosition,
} from './author-position';
import { crossrefAuthorNames, type CrossrefClient } from './crossref.client';
import type { OpenAlexClient, OpenAlexWork } from './openalex.client';
import { parsePersonName, type PersonName } from './person-name';

/**
 * authored: found, and the expert is among the authors (position reported).
 * not_author: at least two catalogs with complete-looking author lists carry
 *   a work with this title and none lists the expert.
 * author_unconfirmed: a work with this title exists but the expert was not in
 *   the author list we could read, and the list may be incomplete (one
 *   catalog only, truncated, or shorter than the CV citation). This is NOT a
 *   finding that the expert did not write it.
 * not_found: no catalog we could reach carries a work with this title.
 * unavailable: no catalog could be reached.
 */
export type PublicationLookupStatus =
  | 'authored'
  | 'not_author'
  | 'author_unconfirmed'
  | 'not_found'
  | 'unavailable';

export type CatalogName = 'OpenAlex' | 'Crossref' | 'PubMed';

export interface CatalogCheck {
  catalog: CatalogName;
  outcome: 'found' | 'not_found' | 'error';
  /** Number of authors the catalog listed for the matching work. */
  authorCount?: number;
}

export interface PublicationLookupResult {
  title: string;
  status: PublicationLookupStatus;
  /** Which catalog produced the match. Absent when nothing was found. */
  catalog?: CatalogName;
  work?: {
    title: string;
    url: string;
    year: number | null;
    authors: string[];
  };
  /** Expert's place in the catalog's author list (when listed). */
  authorPosition?: AuthorPosition;
  authorIndex?: number;
  authorCount?: number;
  /** Place the CV citation gives the expert, when the citation lists authors. */
  cvAuthorPosition?: AuthorPosition | null;
  cvAuthorCount?: number;
  /** confirmed / differs / not_verifiable (catalog list shorter than the CV's). */
  positionCheck?: 'confirmed' | 'differs' | 'not_verifiable';
  /** True when an author list we read looks shorter than the real one. */
  authorListIncomplete?: boolean;
  checks?: CatalogCheck[];
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
  const match = citation.match(/\((?:19|20)\d{2}[a-z]?\)\.\s*([^.]{12,240})/);
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

interface CatalogWork {
  title: string;
  url: string;
  year: number | null;
  authors: string[];
  /** The catalog says it cut the list short. */
  truncated?: boolean;
}

interface CatalogAnswer {
  catalog: CatalogName;
  outcome: 'found' | 'not_found' | 'error';
  work?: CatalogWork;
}

/**
 * Checks titles a CV lists against OpenAlex, Crossref and PubMed and reads
 * the author lists in order. One catalog's short list never proves the
 * expert did not write a paper.
 */
export class PublicationTitleLookup {
  constructor(
    private readonly client: OpenAlexClient,
    private readonly pubmed?: PubMedTitleLookupOptions,
    private readonly crossref?: CrossrefClient,
  ) {}

  async lookup(
    expertName: string,
    titles: string[],
  ): Promise<PublicationLookupResult[]> {
    const expert = parsePersonName(expertName);
    const unique = [...new Set(titles.map((title) => title.trim()))]
      .filter((title) => tokens(title).length >= 3)
      .slice(0, MAX_TITLES);
    return mapWithLimit(unique, 3, (title) => this.lookupOne(title, expert));
  }

  private async lookupOne(
    title: string,
    expert: PersonName | null,
  ): Promise<PublicationLookupResult> {
    const phrase = articleTitle(title);
    const answers = await Promise.all([
      this.fromOpenAlex(phrase),
      this.fromCrossref(phrase),
      this.fromPubMed(phrase),
    ]);
    const checks: CatalogCheck[] = answers.map((answer) => ({
      catalog: answer.catalog,
      outcome: answer.outcome,
      authorCount: answer.work?.authors.length,
    }));
    const found = answers.filter(
      (answer): answer is CatalogAnswer & { work: CatalogWork } =>
        answer.outcome === 'found' && Boolean(answer.work),
    );

    if (found.length === 0) {
      const reachable = answers.some(
        (answer) => answer.outcome === 'not_found',
      );
      return {
        title,
        status: reachable ? 'not_found' : 'unavailable',
        checks,
      };
    }
    if (!expert) {
      return {
        title,
        catalog: found[0].catalog,
        status: 'author_unconfirmed',
        work: summarize(found[0].work),
        authorCount: found[0].work.authors.length,
        authorListIncomplete: false,
        checks,
      };
    }

    const cvAuthors = parseCitationAuthors(title);
    const cvPosition =
      cvAuthors.length > 0 ? authorPositionIn(cvAuthors, expert) : null;
    const cvInfo = {
      cvAuthorPosition:
        cvAuthors.length > 0 ? (cvPosition?.position ?? null) : undefined,
      cvAuthorCount: cvAuthors.length > 0 ? cvAuthors.length : undefined,
    };

    const listed = found
      .map((answer) => ({
        answer,
        place: authorPositionIn(answer.work.authors, expert),
      }))
      .filter((entry) => entry.place !== null)
      .sort(
        (a, b) => b.answer.work.authors.length - a.answer.work.authors.length,
      );

    if (listed.length > 0) {
      const { answer, place } = listed[0];
      const longestFound = Math.max(
        ...found.map((entry) => entry.work.authors.length),
      );
      const listShort =
        answer.work.authors.length < longestFound ||
        cvAuthors.length > answer.work.authors.length;
      let positionCheck: PublicationLookupResult['positionCheck'];
      if (cvPosition) {
        positionCheck = listShort
          ? 'not_verifiable'
          : cvPosition.position === place!.position
            ? 'confirmed'
            : 'differs';
      }
      return {
        title,
        catalog: answer.catalog,
        status: 'authored',
        work: summarize(answer.work),
        authorPosition: place!.position,
        authorIndex: place!.index,
        authorCount: answer.work.authors.length,
        ...cvInfo,
        positionCheck,
        authorListIncomplete: listShort,
        checks,
      };
    }

    const longest = [...found].sort(
      (a, b) => b.work.authors.length - a.work.authors.length,
    )[0];
    const looksComplete = (work: CatalogWork): boolean =>
      !work.truncated &&
      work.authors.length >= 2 &&
      (cvAuthors.length === 0 || work.authors.length >= cvAuthors.length);
    const agreeing = found.filter((entry) => looksComplete(entry.work)).length;
    const conflict = agreeing >= 2;
    return {
      title,
      catalog: longest.catalog,
      status: conflict ? 'not_author' : 'author_unconfirmed',
      work: summarize(longest.work),
      authorCount: longest.work.authors.length,
      ...cvInfo,
      authorListIncomplete: !conflict,
      checks,
    };
  }

  private async fromOpenAlex(phrase: string): Promise<CatalogAnswer> {
    try {
      const works = await this.client.searchWorks(phrase);
      const match = works.find(
        (work) => work.title && sameTitle(phrase, work.title),
      );
      if (!match) return { catalog: 'OpenAlex', outcome: 'not_found' };
      return {
        catalog: 'OpenAlex',
        outcome: 'found',
        work: openAlexWork(match),
      };
    } catch {
      return { catalog: 'OpenAlex', outcome: 'error' };
    }
  }

  private async fromCrossref(phrase: string): Promise<CatalogAnswer> {
    if (!this.crossref) return { catalog: 'Crossref', outcome: 'error' };
    try {
      const works = await this.crossref.searchWorks(phrase);
      const match = works.find((work) => {
        const title = work.title?.[0];
        return Boolean(title && sameTitle(phrase, title));
      });
      if (!match) return { catalog: 'Crossref', outcome: 'not_found' };
      const year = match.issued?.['date-parts']?.[0]?.[0];
      return {
        catalog: 'Crossref',
        outcome: 'found',
        work: {
          title: match.title?.[0] ?? phrase,
          url: match.URL ?? (match.DOI ? `https://doi.org/${match.DOI}` : ''),
          year: typeof year === 'number' ? year : null,
          authors: crossrefAuthorNames(match),
        },
      };
    } catch {
      return { catalog: 'Crossref', outcome: 'error' };
    }
  }

  private async fromPubMed(phrase: string): Promise<CatalogAnswer> {
    if (!this.pubmed) return { catalog: 'PubMed', outcome: 'error' };
    try {
      const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
      const search = new URL(`${base}/esearch.fcgi`);
      search.searchParams.set('db', 'pubmed');
      search.searchParams.set('retmode', 'json');
      search.searchParams.set('retmax', '3');
      search.searchParams.set('tool', 'medical-causation-ai');
      if (this.pubmed.email)
        search.searchParams.set('email', this.pubmed.email);
      if (this.pubmed.apiKey)
        search.searchParams.set('api_key', this.pubmed.apiKey);
      search.searchParams.set('term', `${tokens(phrase).join(' ')}[Title]`);
      const options = {
        timeoutMs: this.pubmed.timeoutMs,
        fetchImpl: this.pubmed.fetchImpl,
      };
      const found = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(
        search,
        options,
      );
      const ids = found.esearchresult?.idlist ?? [];
      if (ids.length === 0) return { catalog: 'PubMed', outcome: 'not_found' };
      const summary = new URL(`${base}/esummary.fcgi`);
      summary.searchParams.set('db', 'pubmed');
      summary.searchParams.set('retmode', 'json');
      summary.searchParams.set('id', ids.join(','));
      summary.searchParams.set('tool', 'medical-causation-ai');
      const payload = await fetchJson<{
        result?: Record<
          string,
          {
            title?: string;
            pubdate?: string;
            authors?: Array<{ name?: string }>;
          }
        >;
      }>(summary, options);
      for (const pmid of ids) {
        const article = payload.result?.[pmid];
        if (!article?.title || !sameTitle(phrase, article.title)) continue;
        const authors = (article.authors ?? [])
          .map((author) => author.name)
          .filter((name): name is string => Boolean(name));
        return {
          catalog: 'PubMed',
          outcome: 'found',
          work: {
            title: article.title,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            year: article.pubdate
              ? Number(article.pubdate.slice(0, 4)) || null
              : null,
            authors,
          },
        };
      }
      return { catalog: 'PubMed', outcome: 'not_found' };
    } catch {
      return { catalog: 'PubMed', outcome: 'error' };
    }
  }
}

function openAlexWork(work: OpenAlexWork): CatalogWork {
  const authors = (work.authorships ?? [])
    .map((authorship) => authorship.author?.display_name)
    .filter((name): name is string => Boolean(name));
  return {
    title: work.title ?? '',
    url: work.doi ?? work.id,
    year: work.publication_year ?? null,
    authors,
    truncated: work.is_authors_truncated === true,
  };
}

function summarize(
  work: CatalogWork,
): NonNullable<PublicationLookupResult['work']> {
  return {
    title: work.title,
    url: work.url,
    year: work.year,
    authors: work.authors.slice(0, 8),
  };
}
