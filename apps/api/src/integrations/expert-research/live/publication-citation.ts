/**
 * Citation fields taken from a CV line: DOI, PMID, year, venue, and type.
 * Used to search catalogs when an exact title lookup misses.
 */

export type ScholarlyType =
  'article' | 'chapter' | 'abstract' | 'presentation' | 'poster' | 'other';

export interface PublicationQuery {
  title: string;
  /** Full CV citation, when different from the title. */
  citation?: string;
  journal?: string;
  year?: number | null;
  doi?: string;
  pmid?: string;
  type?: ScholarlyType;
}

const DOI = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
const PMID = /\b(?:PMID:?\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{5,8})\b/i;
const YEAR = /\b((?:19|20)\d{2})[a-z]?\b/;

export function normalizeDoi(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/[.,;]+$/g, '');
  const match = cleaned.match(DOI);
  return match?.[1]?.replace(/[.,;]+$/g, '');
}

export function parsePmid(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(PMID);
  if (match?.[1]) return match[1];
  if (/^\d{5,8}$/.test(value.trim())) return value.trim();
  return undefined;
}

export function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(YEAR);
  return match ? Number(match[1]) : null;
}

export function classifyPublicationType(
  text: string,
  heading?: string,
): ScholarlyType {
  const head = (heading ?? '').toLowerCase();
  if (/\bposter/.test(head)) return 'poster';
  if (/\babstract/.test(head)) return 'abstract';
  if (/\b(presentation|symposium|proceedings)\b/.test(head)) {
    return 'presentation';
  }
  if (/\bchapters?\b/.test(head)) return 'chapter';
  const hay = `${head} ${text}`.toLowerCase();
  if (/\bposter/.test(hay)) return 'poster';
  if (/\babstract/.test(hay)) return 'abstract';
  if (/\b(presentation|symposium|proceedings|conference paper)\b/.test(hay)) {
    return 'presentation';
  }
  if (
    /\b(book chapter|chapter in|in:)\b/.test(hay) ||
    /\bchapters?\b/.test(hay)
  ) {
    return 'chapter';
  }
  if (
    /\b(journal articles?|peer-reviewed|original article)\b/.test(hay) ||
    /\bpublications\b/.test(head)
  ) {
    return 'article';
  }
  return 'other';
}

export function mapCatalogType(
  catalogType: string | null | undefined,
): ScholarlyType | undefined {
  if (!catalogType) return undefined;
  const type = catalogType.toLowerCase();
  if (type.includes('chapter')) return 'chapter';
  if (type.includes('proceeding') || type.includes('conference')) {
    return 'presentation';
  }
  if (type.includes('posted') || type.includes('preprint')) return 'other';
  if (type === 'article' || type.includes('journal')) return 'article';
  return 'other';
}

export function toPublicationQuery(
  input: string | PublicationQuery,
): PublicationQuery {
  if (typeof input !== 'string') {
    const citation = input.citation ?? input.title;
    return {
      title: input.title,
      citation,
      journal: input.journal,
      year: input.year ?? parseYear(citation),
      doi: normalizeDoi(input.doi) ?? normalizeDoi(citation),
      pmid: parsePmid(input.pmid) ?? parsePmid(citation),
      type: input.type ?? classifyPublicationType(citation),
    };
  }
  return {
    title: input,
    citation: input,
    year: parseYear(input),
    doi: normalizeDoi(input),
    pmid: parsePmid(input),
    type: classifyPublicationType(input),
  };
}

export function similarVenue(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const a = venueKey(left);
  const b = venueKey(right);
  if (a.length < 4 || b.length < 4) return a === b;
  return a.includes(b) || b.includes(a);
}

function venueKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(the|journal|of|and|for|in|&|j|annals|proceedings)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function queryKey(query: PublicationQuery): string {
  if (query.doi) return `doi:${query.doi.toLowerCase()}`;
  if (query.pmid) return `pmid:${query.pmid}`;
  return `title:${query.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

export function indexedAsJournalArticle(type?: ScholarlyType): boolean {
  return type === 'article' || type === 'other' || type === undefined;
}
