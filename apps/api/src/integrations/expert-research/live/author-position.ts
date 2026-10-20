import { authorListed } from './pubmed.provider';
import {
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';

export type AuthorPosition = 'sole' | 'first' | 'last' | 'middle';

/** True when an author string ("Demery JA", "Jason A. Demery", "Demery, J.A.") is the expert. */
export function isExpertAuthor(author: string, expert: PersonName): boolean {
  if (authorListed(author, expert)) return true;
  const parsed = parsePersonName(author);
  return Boolean(parsed && namesCompatible(parsed, expert));
}

/** Where the expert stands in an author list, or null when not listed. */
export function authorPositionIn(
  authors: readonly string[],
  expert: PersonName,
): { position: AuthorPosition; index: number; count: number } | null {
  const index = authors.findIndex((author) => isExpertAuthor(author, expert));
  if (index < 0) return null;
  const count = authors.length;
  const position: AuthorPosition =
    count === 1
      ? 'sole'
      : index === 0
        ? 'first'
        : index === count - 1
          ? 'last'
          : 'middle';
  return { position, index, count };
}

/**
 * Authors named in a CV citation, in order:
 * "Hanlon, R.E., Demery, J.A., Martinovich, Z., & Kelly, J.P. (1999). Title..."
 * or "Hanlon RE, Demery JA (1998). Title". Empty when the text is only a title.
 */
export function parseCitationAuthors(citation: string): string[] {
  const head = citation.split(/\((?:19|20)\d{2}[a-z]?\)/)[0] ?? '';
  if (head.trim().length < 4 || head.length === citation.length) return [];
  const text = head
    .replace(/\s+/g, ' ')
    .replace(/&|\band\b/gi, ',')
    .trim();

  // "Last, F.M." pairs.
  const pairs = [
    ...text.matchAll(
      /([\p{Lu}][\p{L}'’-]+(?:\s[\p{Lu}][\p{L}'’-]+)?),\s*((?:\p{Lu}\.?\s?){1,3})(?=[,;]|$)/gu,
    ),
  ].map((match) => `${match[1]} ${match[2].replace(/[.\s]/g, '')}`);
  if (pairs.length > 0) return pairs;

  // "Last FM" lists.
  return [
    ...text.matchAll(/([\p{Lu}][\p{L}'’-]+)\s+(\p{Lu}{1,3})(?=[,;]|$)/gu),
  ].map((match) => `${match[1]} ${match[2]}`);
}

export function describePosition(
  position: AuthorPosition,
  index: number,
  count: number,
): string {
  switch (position) {
    case 'sole':
      return 'sole author';
    case 'first':
      return `first of ${count} authors`;
    case 'last':
      return `last of ${count} authors`;
    default:
      return `author ${index + 1} of ${count}`;
  }
}
