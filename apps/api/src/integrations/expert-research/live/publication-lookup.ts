import { mapWithLimit } from './live-provider.base';
import type { OpenAlexClient, OpenAlexWork } from './openalex.client';
import { namesCompatible, parsePersonName } from './person-name';

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
  work?: {
    title: string;
    url: string;
    year: number | null;
    authors: string[];
  };
}

const MAX_TITLES = 25;

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
  constructor(private readonly client: OpenAlexClient) {}

  async lookup(
    expertName: string,
    titles: string[],
  ): Promise<PublicationLookupResult[]> {
    const expert = parsePersonName(expertName);
    const unique = [...new Set(titles.map((title) => title.trim()))]
      .filter((title) => tokens(title).length >= 3)
      .slice(0, MAX_TITLES);
    return mapWithLimit(unique, 3, async (title) => {
      try {
        const works = await this.client.searchWorks(title);
        const match = works.find(
          (work) => work.title && sameTitle(title, work.title),
        );
        if (!match) return { title, status: 'not_found' as const };
        const authors = (match.authorships ?? [])
          .map((authorship) => authorship.author?.display_name)
          .filter((name): name is string => Boolean(name));
        const authored = authors.some((author) => {
          const parsed = parsePersonName(author);
          return Boolean(expert && parsed && namesCompatible(parsed, expert));
        });
        return {
          title,
          status: authored ? ('authored' as const) : ('not_author' as const),
          work: describeWork(match, authors),
        };
      } catch {
        return { title, status: 'unavailable' as const };
      }
    });
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
