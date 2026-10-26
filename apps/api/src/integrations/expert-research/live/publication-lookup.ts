import { fetchJson } from './live-http';
import { mapWithLimit } from './live-provider.base';
import {
  authorPositionIn,
  parseCitationAuthors,
  type AuthorPosition,
} from './author-position';
import {
  crossrefAuthorNames,
  type CrossrefClient,
  type CrossrefWork,
} from './crossref.client';
import type { OpenAlexClient, OpenAlexWork } from './openalex.client';
import type { OrcidClient } from './orcid.client';
import {
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';
import {
  classifyPublicationType,
  indexedAsJournalArticle,
  mapCatalogType,
  normalizeDoi,
  queryKey,
  similarVenue,
  toPublicationQuery,
  type PublicationQuery,
  type ScholarlyType,
} from './publication-citation';

export type { PublicationQuery, ScholarlyType } from './publication-citation';

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

export type CatalogName = 'OpenAlex' | 'Crossref' | 'PubMed' | 'ORCID';

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
  doi?: string;
  pmid?: string;
  venue?: string;
  publicationType?: ScholarlyType;
  matchMethod?: 'doi' | 'pmid' | 'title' | 'citation';
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

function titleOverlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  return shared / Math.max(a.length, b.length);
}

interface CatalogWork {
  title: string;
  url: string;
  year: number | null;
  authors: string[];
  doi?: string;
  pmid?: string;
  venue?: string;
  type?: ScholarlyType;
  /** The catalog says it cut the list short. */
  truncated?: boolean;
}

interface CatalogAnswer {
  catalog: CatalogName;
  outcome: 'found' | 'not_found' | 'error';
  method?: PublicationLookupResult['matchMethod'];
  work?: CatalogWork;
}

/** Online-first vs print can differ by a year; a 12-year gap is a different paper. */
export function yearsAgree(
  left?: number | null,
  right?: number | null,
): boolean {
  if (left == null || right == null) return true;
  return Math.abs(left - right) <= 1;
}

function yearsCompatible(query: PublicationQuery, work: CatalogWork): boolean {
  return yearsAgree(query.year, work.year);
}

function matchesQuery(query: PublicationQuery, work: CatalogWork): boolean {
  const phrase = articleTitle(query.title);
  const titleHit =
    sameTitle(phrase, work.title) ||
    (query.citation
      ? sameTitle(articleTitle(query.citation), work.title)
      : false);
  if (titleHit) {
    return yearsCompatible(query, work);
  }
  const overlap = titleOverlap(phrase, work.title);
  if (overlap < 0.5) return false;
  if (!yearsCompatible(query, work)) return false;
  let score = overlap;
  if (query.year && work.year && query.year === work.year) score += 0.2;
  if (similarVenue(query.journal, work.venue)) score += 0.15;
  const cvAuthors = parseCitationAuthors(query.citation ?? query.title);
  if (cvAuthors.length > 0 && work.authors.length > 0) {
    const catalog = work.authors.map((name) => name.toLowerCase());
    const shared = cvAuthors.filter((author) =>
      catalog.some(
        (name) =>
          name.includes(author.split(' ')[0].toLowerCase()) ||
          author.toLowerCase().includes(name.split(' ')[0] ?? ''),
      ),
    ).length;
    if (shared / cvAuthors.length >= 0.5) score += 0.15;
  }
  return score >= 0.75;
}

/**
 * Checks CV citations against OpenAlex, Crossref, PubMed, and ORCID.
 * Identifier lookups run first; remaining catalogs are queried only when
 * the match is missing or the author list looks incomplete. ORCID is used
 * only for DOI/PMID follow-up so a title-only namesake is not imported.
 */
export class PublicationTitleLookup {
  constructor(
    private readonly client: OpenAlexClient,
    private readonly pubmed?: PubMedTitleLookupOptions,
    private readonly crossref?: CrossrefClient,
    private readonly orcid?: OrcidClient,
  ) {}

  async lookup(
    expertName: string,
    citations: Array<string | PublicationQuery>,
  ): Promise<PublicationLookupResult[]> {
    const expert = parsePersonName(expertName);
    const seen = new Set<string>();
    const unique: PublicationQuery[] = [];
    for (const item of citations) {
      const query = toPublicationQuery(item);
      if (
        tokens(articleTitle(query.title)).length < 3 &&
        !query.doi &&
        !query.pmid
      ) {
        continue;
      }
      const key = queryKey(query);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(query);
      if (unique.length >= MAX_TITLES) break;
    }
    return mapWithLimit(unique, 3, (query) => this.lookupOne(query, expert));
  }

  private async lookupOne(
    query: PublicationQuery,
    expert: PersonName | null,
  ): Promise<PublicationLookupResult> {
    const answers: CatalogAnswer[] = [];
    const asked = new Set<string>();

    const take = async (
      key: string,
      run: () => Promise<CatalogAnswer>,
    ): Promise<void> => {
      if (asked.has(key)) return;
      asked.add(key);
      answers.push(await run());
    };

    if (query.doi) {
      await take(`openalex:doi:${query.doi}`, () =>
        this.fromOpenAlexDoi(query.doi!),
      );
      if (!foundWorks(answers).length) {
        await take(`crossref:doi:${query.doi}`, () =>
          this.fromCrossrefDoi(query.doi!),
        );
      }
    }
    if (!foundWorks(answers).length && query.pmid) {
      await take(`pubmed:pmid:${query.pmid}`, () =>
        this.fromPubMedId(query.pmid!),
      );
    }
    if (!foundWorks(answers).length) {
      const phrase = articleTitle(query.title);
      await take(`openalex:title:${phrase}`, () =>
        this.fromOpenAlex(query, phrase),
      );
      if (!foundWorks(answers).length) {
        await take(`crossref:title:${phrase}`, () =>
          this.fromCrossref(query, phrase),
        );
      }
      if (!foundWorks(answers).length && indexedAsJournalArticle(query.type)) {
        await take(`pubmed:title:${phrase}`, () =>
          this.fromPubMed(query, phrase),
        );
      }
    }
    if (
      !foundWorks(answers).length &&
      this.orcid?.configured() &&
      (query.doi || query.pmid)
    ) {
      await take(`orcid:id:${query.doi ?? query.pmid}`, () =>
        this.fromOrcid(query, expert),
      );
    }

    let found = foundWorks(answers);
    if (found.length > 0 && authorsLookShort(found, query) && this.crossref) {
      const doi = query.doi ?? found.find((entry) => entry.work.doi)?.work.doi;
      if (doi) {
        await take(`crossref:doi:${doi}`, () => this.fromCrossrefDoi(doi));
        found = foundWorks(answers);
      } else if (!asked.has(`crossref:title:${articleTitle(query.title)}`)) {
        await take(`crossref:title:${articleTitle(query.title)}`, () =>
          this.fromCrossref(query, articleTitle(query.title)),
        );
        found = foundWorks(answers);
      }
    }

    const checks: CatalogCheck[] = answers.map((answer) => ({
      catalog: answer.catalog,
      outcome: answer.outcome,
      authorCount: answer.work?.authors.length,
    }));
    const extras = extraFields(query, found[0]?.work);

    if (found.length === 0) {
      const reachable = answers.some(
        (answer) => answer.outcome === 'not_found',
      );
      const tried = answers.length > 0;
      return {
        title: query.title,
        status: reachable ? 'not_found' : tried ? 'unavailable' : 'unavailable',
        checks,
        ...extras,
      };
    }
    if (!expert) {
      return {
        title: query.title,
        catalog: found[0].catalog,
        status: 'author_unconfirmed',
        work: summarize(found[0].work),
        authorCount: found[0].work.authors.length,
        authorListIncomplete: false,
        matchMethod: found[0].method,
        checks,
        ...extraFields(query, found[0].work),
      };
    }

    const cvAuthors = parseCitationAuthors(query.citation ?? query.title);
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
        answer.work.truncated === true ||
        answer.work.authors.length < longestFound ||
        cvAuthors.length > answer.work.authors.length;
      let positionCheck: PublicationLookupResult['positionCheck'];
      if (cvPosition) {
        positionCheck = listShort
          ? 'not_verifiable'
          : cvPosition.position === place!.position
            ? 'confirmed'
            : 'differs';
      } else if (listShort) {
        positionCheck = 'not_verifiable';
      }
      return {
        title: query.title,
        catalog: answer.catalog,
        status: 'authored',
        work: summarize(answer.work),
        authorPosition: place!.position,
        authorIndex: place!.index,
        authorCount: answer.work.authors.length,
        matchMethod: answer.method,
        ...cvInfo,
        positionCheck,
        authorListIncomplete: listShort,
        checks,
        ...extraFields(query, answer.work),
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
      title: query.title,
      catalog: longest.catalog,
      status: conflict ? 'not_author' : 'author_unconfirmed',
      work: summarize(longest.work),
      authorCount: longest.work.authors.length,
      matchMethod: longest.method,
      ...cvInfo,
      authorListIncomplete: !conflict,
      checks,
      ...extraFields(query, longest.work),
    };
  }

  private async fromOpenAlex(
    query: PublicationQuery,
    phrase: string,
  ): Promise<CatalogAnswer> {
    try {
      const works = await this.client.searchWorks(phrase);
      const match = works
        .map(openAlexWork)
        .find((work) => matchesQuery(query, work));
      if (!match) return { catalog: 'OpenAlex', outcome: 'not_found' };
      return {
        catalog: 'OpenAlex',
        outcome: 'found',
        method: 'title',
        work: match,
      };
    } catch {
      return { catalog: 'OpenAlex', outcome: 'error' };
    }
  }

  private async fromOpenAlexDoi(doi: string): Promise<CatalogAnswer> {
    try {
      const match = await this.client.workByDoi(doi);
      if (!match) return { catalog: 'OpenAlex', outcome: 'not_found' };
      return {
        catalog: 'OpenAlex',
        outcome: 'found',
        method: 'doi',
        work: openAlexWork(match),
      };
    } catch {
      return { catalog: 'OpenAlex', outcome: 'error' };
    }
  }

  private async fromCrossref(
    query: PublicationQuery,
    phrase: string,
  ): Promise<CatalogAnswer> {
    if (!this.crossref) return { catalog: 'Crossref', outcome: 'error' };
    try {
      const works = await this.crossref.searchWorks(phrase);
      const match = works
        .map((work) => crossrefWork(work, phrase))
        .find((work) => matchesQuery(query, work));
      if (!match) return { catalog: 'Crossref', outcome: 'not_found' };
      return {
        catalog: 'Crossref',
        outcome: 'found',
        method: 'title',
        work: match,
      };
    } catch {
      return { catalog: 'Crossref', outcome: 'error' };
    }
  }

  private async fromCrossrefDoi(doi: string): Promise<CatalogAnswer> {
    if (!this.crossref) return { catalog: 'Crossref', outcome: 'error' };
    try {
      const match = await this.crossref.workByDoi(doi);
      if (!match) return { catalog: 'Crossref', outcome: 'not_found' };
      return {
        catalog: 'Crossref',
        outcome: 'found',
        method: 'doi',
        work: crossrefWork(match, doi),
      };
    } catch {
      return { catalog: 'Crossref', outcome: 'error' };
    }
  }

  private async fromPubMed(
    query: PublicationQuery,
    phrase: string,
  ): Promise<CatalogAnswer> {
    return this.pubmedSearch(
      `${tokens(phrase).join(' ')}[Title]`,
      query,
      'title',
    );
  }

  private async fromPubMedId(pmid: string): Promise<CatalogAnswer> {
    return this.pubmedSummaries([pmid], undefined, 'pmid');
  }

  private async pubmedSearch(
    term: string,
    query: PublicationQuery | undefined,
    method: NonNullable<CatalogAnswer['method']>,
  ): Promise<CatalogAnswer> {
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
      search.searchParams.set('term', term);
      const found = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(
        search,
        {
          timeoutMs: this.pubmed.timeoutMs,
          fetchImpl: this.pubmed.fetchImpl,
        },
      );
      const ids = found.esearchresult?.idlist ?? [];
      if (ids.length === 0) return { catalog: 'PubMed', outcome: 'not_found' };
      return this.pubmedSummaries(ids, query, method);
    } catch {
      return { catalog: 'PubMed', outcome: 'error' };
    }
  }

  private async pubmedSummaries(
    ids: string[],
    query: PublicationQuery | undefined,
    method: NonNullable<CatalogAnswer['method']>,
  ): Promise<CatalogAnswer> {
    if (!this.pubmed) return { catalog: 'PubMed', outcome: 'error' };
    try {
      const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
      const summary = new URL(`${base}/esummary.fcgi`);
      summary.searchParams.set('db', 'pubmed');
      summary.searchParams.set('retmode', 'json');
      summary.searchParams.set('id', ids.join(','));
      summary.searchParams.set('tool', 'medical-causation-ai');
      if (this.pubmed.email)
        summary.searchParams.set('email', this.pubmed.email);
      if (this.pubmed.apiKey)
        summary.searchParams.set('api_key', this.pubmed.apiKey);
      const payload = await fetchJson<{
        result?: Record<
          string,
          {
            title?: string;
            pubdate?: string;
            fulljournalname?: string;
            source?: string;
            elocationid?: string;
            pubtype?: string[];
            articleids?: Array<{ idtype?: string; value?: string }>;
            authors?: Array<{ name?: string }>;
          }
        >;
      }>(summary, {
        timeoutMs: this.pubmed.timeoutMs,
        fetchImpl: this.pubmed.fetchImpl,
      });
      for (const pmid of ids) {
        const article = payload.result?.[pmid];
        if (!article?.title) continue;
        const authors = (article.authors ?? [])
          .map((author) => author.name)
          .filter((name): name is string => Boolean(name));
        const doi = article.articleids?.find(
          (id) => id.idtype === 'doi',
        )?.value;
        const work: CatalogWork = {
          title: article.title,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          year: article.pubdate
            ? Number(article.pubdate.slice(0, 4)) || null
            : null,
          authors,
          doi: doi ?? undefined,
          pmid,
          venue: article.fulljournalname ?? article.source,
          type: mapCatalogType(article.pubtype?.[0]) ?? 'article',
        };
        if (query && method !== 'pmid' && !matchesQuery(query, work)) continue;
        return {
          catalog: 'PubMed',
          outcome: 'found',
          method,
          work,
        };
      }
      return { catalog: 'PubMed', outcome: 'not_found' };
    } catch {
      return { catalog: 'PubMed', outcome: 'error' };
    }
  }

  /**
   * ORCID follow-up for a DOI or PMID the other catalogs missed. Title-only
   * search is not used. A work on the profile without a contributor list is
   * returned with an empty author list (author_unconfirmed), not as verified
   * authorship.
   */
  private async fromOrcid(
    query: PublicationQuery,
    expert: PersonName | null,
  ): Promise<CatalogAnswer> {
    if (!this.orcid?.configured()) {
      return { catalog: 'ORCID', outcome: 'error' };
    }
    try {
      const hits = query.doi
        ? await this.orcid.searchByDoi(query.doi, expert?.last)
        : query.pmid
          ? await this.orcid.searchByPmid(query.pmid, expert?.last)
          : [];
      const named = expert
        ? hits.filter((hit) => {
            const listed = parsePersonName(
              `${hit.givenNames} ${hit.familyNames}`,
            );
            return listed ? namesCompatible(expert, listed) : false;
          })
        : hits;
      if (named.length !== 1) {
        return { catalog: 'ORCID', outcome: 'not_found' };
      }
      const record = await this.orcid.record(named[0].orcid);
      const work = (record?.works ?? []).find((entry) => {
        if (query.doi && entry.doi && normalizeDoi(query.doi) === entry.doi) {
          return true;
        }
        if (query.pmid && entry.pmid === query.pmid) return true;
        return false;
      });
      if (!work) return { catalog: 'ORCID', outcome: 'not_found' };
      return {
        catalog: 'ORCID',
        outcome: 'found',
        method: query.doi ? 'doi' : 'pmid',
        work: {
          title: work.title,
          url: work.url,
          year: work.year,
          authors: work.authors,
          doi: work.doi,
          pmid: work.pmid,
          venue: work.journal,
          type: work.type,
          truncated: work.authors.length === 0,
        },
      };
    } catch {
      return { catalog: 'ORCID', outcome: 'error' };
    }
  }
}

function foundWorks(
  answers: CatalogAnswer[],
): Array<CatalogAnswer & { work: CatalogWork }> {
  return answers.filter(
    (answer): answer is CatalogAnswer & { work: CatalogWork } =>
      answer.outcome === 'found' && Boolean(answer.work),
  );
}

function authorsLookShort(
  found: Array<CatalogAnswer & { work: CatalogWork }>,
  query: PublicationQuery,
): boolean {
  const cvAuthors = parseCitationAuthors(query.citation ?? query.title);
  return found.every(
    (entry) =>
      entry.work.truncated === true ||
      entry.work.authors.length < 2 ||
      (cvAuthors.length > 0 && entry.work.authors.length < cvAuthors.length),
  );
}

function extraFields(
  query: PublicationQuery,
  work?: CatalogWork,
): Pick<PublicationLookupResult, 'doi' | 'pmid' | 'venue' | 'publicationType'> {
  return {
    doi: work?.doi ?? query.doi,
    pmid: work?.pmid ?? query.pmid,
    venue: work?.venue ?? query.journal,
    publicationType:
      work?.type ??
      query.type ??
      classifyPublicationType(query.citation ?? query.title),
  };
}

function openAlexWork(work: OpenAlexWork): CatalogWork {
  const authors = (work.authorships ?? [])
    .map((authorship) => authorship.author?.display_name)
    .filter((name): name is string => Boolean(name));
  const doi = work.doi
    ? work.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    : undefined;
  return {
    title: work.title ?? '',
    url: work.doi ?? work.id,
    year: work.publication_year ?? null,
    authors,
    doi,
    venue: work.primary_location?.source?.display_name ?? undefined,
    type: mapCatalogType(work.type),
    truncated: work.is_authors_truncated === true,
  };
}

function crossrefWork(work: CrossrefWork, fallbackTitle: string): CatalogWork {
  const year = work.issued?.['date-parts']?.[0]?.[0];
  return {
    title: work.title?.[0] ?? fallbackTitle,
    url: work.URL ?? (work.DOI ? `https://doi.org/${work.DOI}` : ''),
    year: typeof year === 'number' ? year : null,
    authors: crossrefAuthorNames(work),
    doi: work.DOI,
    venue: work['container-title']?.[0],
    type: mapCatalogType(work.type),
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
