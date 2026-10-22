export type CaptionStatus = 'from_source' | 'unresolved';

const UNRESOLVED_CAPTION = 'Caption not listed on this search result';
const KEEP_UPPER = new Set([
  'llc',
  'llp',
  'inc',
  'ltd',
  'pa',
  'usa',
  'usaa',
  'md',
  'phd',
]);

/** Known complete short tokens that appear as party names or suffixes. */
const COMPLETE_SHORT = new Set([
  ...KEEP_UPPER,
  'pc',
  'plc',
  'co',
  'corp',
  'na',
  'jr',
  'sr',
  'ii',
  'iii',
  'iv',
  'et',
  'al',
  'the',
  'of',
  'and',
  'for',
  'new',
  'dba',
  'aka',
]);

/**
 * Common case-name words. A last token that is only a prefix of one of these
 * is treated as truncated (for example "insur" from "insurance").
 */
const COMMON_CASE_WORDS = [
  'company',
  'corporation',
  'incorporated',
  'insurance',
  'indemnity',
  'association',
  'hospital',
  'university',
  'foundation',
  'services',
  'systems',
  'partners',
  'holdings',
  'authority',
  'department',
  'limited',
  'national',
  'mutual',
  'casualty',
  'assurance',
  'healthcare',
  'medical',
  'center',
  'county',
  'district',
  'commission',
  'government',
  'america',
];

/** Last non-numeric docket-URL segment, which CourtListener uses as the caption slug. */
export function captionFromDocketUrl(path?: string | null): string | null {
  const slug = docketCaptionSlug(path);
  if (!slug || !captionSlugIsReliable(slug)) return null;
  return formatCaptionSlug(slug);
}

export function formatCaptionSlug(slug: string): string {
  return slug
    .split('-')
    .map((word, index, all) => {
      if (word === 'v' && index > 0 && index < all.length - 1) return 'v.';
      if (KEEP_UPPER.has(word.toLowerCase())) return word.toUpperCase();
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/\s+v\.\s+/g, ' v. ');
}

/**
 * True when both parties look complete enough to print as a caption.
 * Truncated slugs such as `united-states-v-butl` return false.
 */
export function captionSlugIsReliable(slug: string): boolean {
  const tokens = slug.toLowerCase().split('-').filter(Boolean);
  const versus = tokens.indexOf('v');
  if (versus <= 0 || versus >= tokens.length - 1) return false;
  const plaintiff = tokens.slice(0, versus);
  const defendant = tokens.slice(versus + 1);
  if (!partyLooksReliable(plaintiff) || !partyLooksReliable(defendant)) {
    return false;
  }
  return tokenLooksComplete(tokens[tokens.length - 1] ?? '');
}

function docketCaptionSlug(path?: string | null): string | null {
  if (!path) return null;
  const parts = path.split(/[/?#]/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (/^\d+$/.test(part) || /^docket$/i.test(part)) continue;
    if (!/-v-/.test(part)) continue;
    return part;
  }
  return null;
}

function usableCaption(value?: string | null, path?: string | null): string {
  const text = value?.trim() ?? '';
  if (!text) return '';
  if (/^unnamed case$/i.test(text)) return '';
  if (/caption not listed/i.test(text)) return '';
  if (derivedFromUnreliableSlug(text, path)) return '';
  if (formattedCaptionLooksCutOff(text)) return '';
  return text;
}

/**
 * A stored caption that is only the title-cased truncated slug is not a
 * complete party name.
 */
function derivedFromUnreliableSlug(
  name: string,
  path?: string | null,
): boolean {
  const slug = docketCaptionSlug(path);
  if (!slug || captionSlugIsReliable(slug)) return false;
  return normalizeCaption(name) === normalizeCaption(formatCaptionSlug(slug));
}

function formattedCaptionLooksCutOff(name: string): boolean {
  const last = lastCaptionWord(name);
  if (!last) return true;
  if (COMPLETE_SHORT.has(last)) return false;
  return isTruncatedPrefix(last);
}

function lastCaptionWord(name: string): string {
  const words = name
    .replace(/\./g, '')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase())
    .filter(Boolean);
  return words[words.length - 1] ?? '';
}

function normalizeCaption(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function partyLooksReliable(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.some((token) => tokenLooksComplete(token));
}

function tokenLooksComplete(token: string): boolean {
  const value = token.toLowerCase();
  if (!value) return false;
  if (COMPLETE_SHORT.has(value)) return true;
  if (isTruncatedPrefix(value)) return false;
  if (value.length >= 5) return true;
  // Short complete names such as Roe or Lee; 4-letter leftovers such as
  // "butl" stay unresolved.
  return value.length === 3 && /[aeiouy]/.test(value);
}

function isTruncatedPrefix(token: string): boolean {
  if (token.length < 4) return false;
  return COMMON_CASE_WORDS.some(
    (word) => word.startsWith(token) && token.length < word.length,
  );
}

/** Caption from API fields or the docket URL slug; never invents Unnamed case. */
export function resolveCaseCaption(hit: {
  caseName?: string | null;
  caseNameFull?: string | null;
  case_name?: string | null;
  absolute_url?: string | null;
  url?: string | null;
}): { name: string; status: CaptionStatus } {
  const path = hit.absolute_url ?? hit.url ?? undefined;
  const fromSource =
    usableCaption(hit.caseName, path) ||
    usableCaption(hit.caseNameFull, path) ||
    usableCaption(hit.case_name, path);
  if (fromSource) return { name: fromSource, status: 'from_source' };
  const fromUrl = captionFromDocketUrl(path);
  if (fromUrl) return { name: fromUrl, status: 'from_source' };
  return { name: UNRESOLVED_CAPTION, status: 'unresolved' };
}
