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

/** Last non-numeric docket-URL segment, which CourtListener uses as the caption slug. */
export function captionFromDocketUrl(path?: string | null): string | null {
  if (!path) return null;
  const parts = path.split(/[/?#]/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (/^\d+$/.test(part) || /^docket$/i.test(part)) continue;
    if (!/-v-/.test(part)) continue;
    return formatCaptionSlug(part);
  }
  return null;
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

function usableCaption(value?: string | null): string {
  const text = value?.trim() ?? '';
  if (!text) return '';
  if (/^unnamed case$/i.test(text)) return '';
  if (/caption not listed/i.test(text)) return '';
  return text;
}

/** Caption from API fields or the docket URL slug; never invents Unnamed case. */
export function resolveCaseCaption(hit: {
  caseName?: string | null;
  caseNameFull?: string | null;
  case_name?: string | null;
  absolute_url?: string | null;
  url?: string | null;
}): { name: string; status: CaptionStatus } {
  const fromSource =
    usableCaption(hit.caseName) ||
    usableCaption(hit.caseNameFull) ||
    usableCaption(hit.case_name);
  if (fromSource) return { name: fromSource, status: 'from_source' };
  const fromUrl = captionFromDocketUrl(
    hit.absolute_url ?? hit.url ?? undefined,
  );
  if (fromUrl) return { name: fromUrl, status: 'from_source' };
  return { name: UNRESOLVED_CAPTION, status: 'unresolved' };
}
