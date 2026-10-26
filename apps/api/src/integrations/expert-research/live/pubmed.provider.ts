import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { fetchJson } from './live-http';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { parseCityState } from './location';
import { parsePersonName, type PersonName } from './person-name';

const DEFAULT_MAX_ARTICLES = 40;
const PUBMED_MAX_ARTICLES_CAP = 200;
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
  articleids?: Array<{ idtype?: string; value?: string }>;
  elocationid?: string;
}

/**
 * PubMed author search. An article is kept only when an author string matches
 * the expert’s last name and first initial (and middle initial when both
 * sides have one). The summary does not prove affiliation.
 */
export class PubMedResearchProvider extends LiveResearchProvider {
  private readonly maxArticles: number;

  constructor(
    definition: ProviderDefinition,
    private readonly fetchImpl: typeof fetch | undefined,
    private readonly timeoutMs: number,
    private readonly apiKey?: string,
    private readonly email?: string,
    maxArticles?: number,
  ) {
    super(definition);
    this.maxArticles = clampPubMedMax(maxArticles);
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
        message: 'Not searched. PubMed needs the expert’s first and last name.',
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
    const matched = summaries
      .filter((article) =>
        (article.authors ?? []).some((author) =>
          authorListed(author.name ?? '', name),
        ),
      )
      .slice(0, this.maxArticles);
    if (matched.length === 0) {
      return {
        items: [],
        message: `PubMed returned ${ids.length} id(s) for ${name.last}, but none of the author lists matched the expert’s initials. Nothing was attributed.`,
      };
    }
    const xmlBundle = await this.fetchXml(
      matched.map((article) => article.uid ?? '').filter(Boolean),
    );
    const affiliations = xmlBundle
      ? parseAuthorAffiliations(xmlBundle, name)
      : new Map<string, string[]>();
    const grantsByPmid = xmlBundle
      ? parseArticleGrants(xmlBundle)
      : new Map<string, ArticleGrant[]>();
    const confirmed: string[] = [];
    const unconfirmed: string[] = [];
    const items = matched.flatMap((article) => {
      const listed = affiliations.get(article.uid ?? '') ?? [];
      const agreement = affiliationAgrees(listed, query);
      (agreement ? confirmed : unconfirmed).push(
        `“${article.title ?? 'Untitled'}”${article.pubdate ? ` (${article.pubdate.slice(0, 4)})` : ''}`,
      );
      const grants = grantsByPmid.get(article.uid ?? '') ?? [];
      return [
        this.articleItem(
          article,
          name,
          retrievedAt,
          listed,
          agreement,
          query,
          grants,
        ),
      ];
    });
    const checked = affiliations.size > 0;
    return {
      items,
      message: [
        `${matched.length} PubMed article(s) list an author matching ${name.last} and the expert’s initials.`,
        confirmed.length > 0
          ? `${confirmed.length} also list an affiliation that agrees with the expert’s place, specialty or note and are attributed to the expert.`
          : null,
        unconfirmed.length > 0
          ? checked
            ? `${unconfirmed.length} could not be tied to the expert (no affiliation listed, or one that does not agree) and are not attributed: ${unconfirmed.slice(0, 6).join('; ')}${unconfirmed.length > 6 ? '; …' : ''}.`
            : `Affiliations could not be read from PubMed, so ${unconfirmed.length} article(s) are not attributed: ${unconfirmed.slice(0, 6).join('; ')}${unconfirmed.length > 6 ? '; …' : ''}.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  private async fetchXml(pmids: string[]): Promise<string | null> {
    if (pmids.length === 0) return null;
    try {
      const url = this.endpoint('efetch.fcgi', { id: pmids.join(',') });
      url.searchParams.set('retmode', 'xml');
      const response = await (this.fetchImpl ?? fetch)(url, {
        headers: { Accept: 'application/xml' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  private async searchIds(name: PersonName): Promise<string[]> {
    const initials = `${name.first[0]}${name.middle[0]?.[0] ?? ''}`;
    const url = this.endpoint('esearch.fcgi', {
      term: `${name.last} ${initials}[Author]`,
      retmax: String(this.maxArticles),
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
    affiliations: string[],
    agreement: string | null,
    query: ExpertResearchQuery,
    grants: ArticleGrant[] = [],
  ): ExpertEvidenceItem {
    const pmid = article.uid ?? '';
    const authors = (article.authors ?? [])
      .map((author) => author.name)
      .filter((value): value is string => Boolean(value));
    const journal =
      article.fulljournalname || article.source || 'journal not listed';
    const year = article.pubdate?.slice(0, 4);
    const doi = doiFromSummary(article);
    const place = authorPlace(authors, name);
    return this.item({
      category: 'publication',
      title: article.title ?? 'Untitled PubMed article',
      summary: [
        `PubMed lists “${article.title}”`,
        year ? `(${year})` : null,
        `in ${journal}.`,
        authors.length > 0 ? `Authors: ${authors.join(', ')}.` : null,
        place
          ? `Listed as ${place.position === 'sole' ? 'the sole author' : place.position === 'first' ? 'first author' : place.position === 'last' ? 'last author' : `author ${place.index + 1} of ${place.count}`}.`
          : null,
        `An author string matches ${name.last} and the expert’s initials.`,
        affiliations.length > 0
          ? `Affiliation listed for this author: ${affiliations[0].slice(0, 300)}.`
          : null,
        agreement
          ? `The affiliation agrees with the expert (${agreement}). An affiliation is not proof of identity.`
          : 'No affiliation that agrees with the expert’s place or specialty was found, so it is not proof the article belongs to this expert.',
        grants.length > 0
          ? `The article lists grant support: ${grants
              .slice(0, 4)
              .map((grant) =>
                [grant.id, grant.agency].filter(Boolean).join(' '),
              )
              .join(
                '; ',
              )}. Being named as an author on a funded paper is not a personal grant award.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        pmid,
        doi,
        authors,
        authorPosition: place?.position ?? null,
        authorIndex: place?.index ?? null,
        authorCount: place?.count ?? authors.length,
        journal,
        pubdate: article.pubdate ?? null,
        affiliations,
        grants,
        ...(agreement
          ? {
              identity: {
                name: query.expertName,
                verifiedBy: 'source_match',
              },
            }
          : {}),
      },
    });
  }
}

function clampPubMedMax(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_ARTICLES;
  return Math.min(
    PUBMED_MAX_ARTICLES_CAP,
    Math.max(1, Math.floor(value as number)),
  );
}

function doiFromSummary(article: PubMedSummary): string | null {
  const fromIds = (article.articleids ?? []).find(
    (id) => id.idtype?.toLowerCase() === 'doi',
  )?.value;
  if (fromIds?.trim()) return fromIds.trim();
  const elocation = article.elocationid?.trim();
  if (elocation && /^10\.\d{4,}/.test(elocation.replace(/^doi:\s*/i, ''))) {
    return elocation.replace(/^doi:\s*/i, '');
  }
  return null;
}

function authorPlace(
  authors: string[],
  name: PersonName,
): {
  position: 'sole' | 'first' | 'last' | 'middle';
  index: number;
  count: number;
} | null {
  const index = authors.findIndex((author) => authorListed(author, name));
  if (index < 0) return null;
  const count = authors.length;
  const position =
    count === 1
      ? 'sole'
      : index === 0
        ? 'first'
        : index === count - 1
          ? 'last'
          : 'middle';
  return { position, index, count };
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

function decodeXml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Affiliations PubMed lists for the expert's own author entry, by PMID.
 * Only the entry whose name matches the expert is read; co-authors'
 * affiliations never count.
 */
export function parseAuthorAffiliations(
  xml: string,
  name: PersonName,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const article of xml.split(/<PubmedArticle>/).slice(1)) {
    const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const found: string[] = [];
    for (const author of article.matchAll(
      /<Author\b[^>]*>([\s\S]*?)<\/Author>/g,
    )) {
      const body = author[1];
      const last = body.match(/<LastName>([\s\S]*?)<\/LastName>/)?.[1];
      const given =
        body.match(/<ForeName>([\s\S]*?)<\/ForeName>/)?.[1] ??
        body.match(/<Initials>([\s\S]*?)<\/Initials>/)?.[1];
      if (!last || !given) continue;
      if (!authorListed(`${decodeXml(last)} ${decodeXml(given)}`, name))
        continue;
      for (const affiliation of body.matchAll(
        /<Affiliation>([\s\S]*?)<\/Affiliation>/g,
      )) {
        const text = decodeXml(affiliation[1]);
        if (text) found.push(text);
      }
    }
    if (found.length > 0) out.set(pmid, found);
  }
  return out;
}

export interface ArticleGrant {
  id: string;
  agency: string;
}

/** GrantList entries on each article, by PMID. Article-level, not PI proof. */
export function parseArticleGrants(xml: string): Map<string, ArticleGrant[]> {
  const out = new Map<string, ArticleGrant[]>();
  for (const article of xml.split(/<PubmedArticle>/).slice(1)) {
    const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const grants: ArticleGrant[] = [];
    const seen = new Set<string>();
    for (const block of article.matchAll(
      /<Grant\b[^>]*>([\s\S]*?)<\/Grant>/g,
    )) {
      const id = decodeXml(
        block[1].match(/<GrantID>([\s\S]*?)<\/GrantID>/)?.[1] ?? '',
      );
      const agency = decodeXml(
        block[1].match(/<Agency>([\s\S]*?)<\/Agency>/)?.[1] ?? '',
      );
      const key = `${id}|${agency}`;
      if ((!id && !agency) || seen.has(key)) continue;
      seen.add(key);
      grants.push({ id, agency });
    }
    if (grants.length > 0) out.set(pmid, grants);
  }
  return out;
}

function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(ists?|y|ics?|ic|ian|ology)$/, '')
    .slice(0, 12);
}

/**
 * Whether a listed affiliation agrees with the expert's place, specialty or
 * the attorney's note. Returns what it agreed on, or null.
 */
export function affiliationAgrees(
  affiliations: string[],
  query: ExpertResearchQuery,
): string | null {
  if (affiliations.length === 0) return null;
  const text = affiliations.join(' ').toLowerCase();
  const city = parseCityState(query.city || '').city?.toLowerCase();
  if (city && city.length > 2 && text.includes(city)) {
    return `place: ${city}`;
  }
  const specialty = query.specialty
    .split(/[\s,/&-]+/)
    .filter((word) => word.length > 4)
    .map(stem)
    .find((root) => root.length >= 5 && text.includes(root));
  if (specialty) return `specialty: ${query.specialty.trim()}`;
  const terms = (query.context ?? '')
    .split(/[,;\n]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 6 && term.length <= 70);
  const hit = terms.find((term) => text.includes(term));
  return hit ? `note: ${hit}` : null;
}
