import { decodeHtmlEntities } from './page-text';

export type PortraitVia = 'og' | 'twitter' | 'jsonld' | 'img';

export interface PortraitCandidate {
  url: string;
  via: PortraitVia;
  /** Alt text, CSS hint, or JSON-LD Person name, when the markup stated one. */
  label?: string;
}

/** Site chrome, not a photograph of a person. */
const JUNK =
  /logo|favicon|sprite|wordmark|placeholder|default[-_]?avatar|badge|seal|banner|hero[-_]?bg|tracking|pixel|1x1|icon[-_./]|apple-touch/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|#|$)/i;
/**
 * Markup or URL that usually means a staff / faculty / practice headshot,
 * not a decorative image.
 */
export const PORTRAIT_HINT =
  /head[-_]?shot|portrait|profile[-_]?photo|staff[-_]?(?:photo|img|image)|bio[-_]?photo|physician[-_]?photo|faculty[-_]?photo|team[-_]?photo|provider[-_]?photo|doctor[-_]?(?:photo|img)|profile[-_]?img/i;

const PHOTO_PAGE_KINDS = new Set([
  'expert_website',
  'advertising',
  'ime',
  'profile',
  'directory',
  'university',
  'review',
  'other',
]);
const OWN_PHOTO_KINDS = new Set([
  'expert_website',
  'advertising',
  'ime',
  'profile',
  'other',
]);

export interface PortraitPageContext {
  kind: string;
  matchLevel: string;
  surname: string;
}

/**
 * Public portrait URLs on a page. These are candidates only: a photo is
 * used after identity matching, and only when the image itself can be read.
 */
export function extractPortraitCandidates(
  html: string,
  pageUrl: string,
): PortraitCandidate[] {
  const found: PortraitCandidate[] = [];
  const seen = new Set<string>();
  const take = (raw: string, via: PortraitVia, label?: string) => {
    const url = resolveUrl(raw, pageUrl);
    if (!url || seen.has(url) || JUNK.test(url)) return;
    seen.add(url);
    found.push({ url, via, ...(label ? { label } : {}) });
  };

  const og = metaContent(html, ['og:image', 'og:image:url']);
  if (og) take(og, 'og');
  const twitter = metaContent(html, ['twitter:image', 'twitter:image:src']);
  if (twitter) take(twitter, 'twitter');
  const itemprop = metaContent(html, ['image']);
  if (itemprop) take(itemprop, 'og');

  for (const image of jsonLdPersonImages(html)) {
    take(image.url, 'jsonld', image.name);
  }

  for (const img of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = img[1];
    const src = imgSrc(attrs);
    if (!src) continue;
    const alt = attr(attrs, 'alt') ?? attr(attrs, 'title') ?? '';
    const hint = `${attr(attrs, 'class') ?? ''} ${attr(attrs, 'id') ?? ''} ${src}`;
    if (JUNK.test(alt) || JUNK.test(src) || JUNK.test(hint)) continue;
    const looksPortrait = PORTRAIT_HINT.test(hint) || PORTRAIT_HINT.test(alt);
    if (!IMAGE_EXT.test(src) && !alt.trim() && !looksPortrait) continue;
    const label = [alt.trim(), looksPortrait ? 'headshot' : '']
      .filter(Boolean)
      .join(' ');
    take(src, 'img', label || undefined);
  }

  return found.slice(0, 12);
}

/**
 * Conditions for using a candidate as this expert's profile photo:
 * 1. The page is a practice, faculty, profile, directory or review page
 *    already judged to be about this person (not news, court, video or social).
 * 2. A possible match is used only on the person's own site.
 * 3. An `<img>` or JSON-LD photo must name the surname, or (on a strong
 *    match) look like a headshot in the URL, alt text or CSS class.
 * 4. Open Graph / Twitter images are used on the person's own site; on a
 *    directory, university or review page they also need a name or headshot hint.
 */
export function usablePortraitCandidates(
  candidates: readonly PortraitCandidate[],
  page: PortraitPageContext,
): PortraitCandidate[] {
  if (!PHOTO_PAGE_KINDS.has(page.kind)) return [];
  if (page.matchLevel !== 'strong' && page.matchLevel !== 'possible') {
    return [];
  }
  const own = OWN_PHOTO_KINDS.has(page.kind);
  if (page.matchLevel === 'possible' && !own) return [];

  const surnameRe = surnamePattern(page.surname);
  if (!surnameRe) return [];

  return candidates.filter((candidate) => {
    if (JUNK.test(candidate.url) || JUNK.test(candidate.label ?? '')) {
      return false;
    }
    const named =
      Boolean(candidate.label && surnameRe.test(candidate.label)) ||
      surnameRe.test(candidate.url);
    const looksPortrait = PORTRAIT_HINT.test(
      `${candidate.url} ${candidate.label ?? ''}`,
    );
    if (candidate.via === 'img' || candidate.via === 'jsonld') {
      return named || (looksPortrait && page.matchLevel === 'strong');
    }
    if (own) return true;
    return named || looksPortrait;
  });
}

function surnamePattern(surname: string): RegExp | null {
  const trimmed = surname.trim();
  if (trimmed.length < 2) return null;
  return new RegExp(
    `\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  );
}

function imgSrc(attrs: string): string | null {
  const srcset = attr(attrs, 'srcset') ?? attr(attrs, 'data-srcset');
  if (srcset) {
    const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
    if (first) return first;
  }
  return (
    attr(attrs, 'src') ??
    attr(attrs, 'data-src') ??
    attr(attrs, 'data-lazy-src') ??
    attr(attrs, 'data-original')
  );
}

function metaContent(html: string, names: readonly string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${escaped}["']`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]?.trim()) return decodeHtmlEntities(match[1]).trim();
    }
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'),
  );
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function jsonLdPersonImages(
  html: string,
): Array<{ url: string; name?: string }> {
  const out: Array<{ url: string; name?: string }> = [];
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walkJsonLd(JSON.parse(block[1]), out);
    } catch {
      // Invalid JSON-LD is ignored.
    }
  }
  return out;
}

function walkJsonLd(
  node: unknown,
  out: Array<{ url: string; name?: string }>,
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  const rec = node as Record<string, unknown>;
  const type = rec['@type'];
  const types = (Array.isArray(type) ? type : [type]).filter(
    (value): value is string => typeof value === 'string',
  );
  const isPerson = types.some((value) => /person/i.test(value));
  const name = typeof rec.name === 'string' ? rec.name : undefined;
  if (isPerson) {
    const image = rec.image;
    if (typeof image === 'string') out.push({ url: image, name });
    else if (image && typeof image === 'object' && !Array.isArray(image)) {
      const url = (image as Record<string, unknown>).url;
      if (typeof url === 'string') out.push({ url, name });
    }
  }
  for (const value of Object.values(rec)) walkJsonLd(value, out);
}

function resolveUrl(raw: string, pageUrl: string): string | null {
  const value = raw.trim();
  if (!value || value.startsWith('data:')) return null;
  try {
    const url = new URL(value, pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
