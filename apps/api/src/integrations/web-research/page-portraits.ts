import { decodeHtmlEntities } from './page-text';

export type PortraitVia = 'og' | 'twitter' | 'jsonld' | 'img';

export interface PortraitCandidate {
  url: string;
  via: PortraitVia;
  /** Alt text or JSON-LD Person name, when the markup stated one. */
  label?: string;
}

const JUNK =
  /logo|favicon|sprite|wordmark|placeholder|default[-_]?avatar|badge|seal|banner|hero[-_]?bg|tracking|pixel|1x1|icon[-_./]|apple-touch/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|#|$)/i;

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

  for (const image of jsonLdPersonImages(html)) {
    take(image.url, 'jsonld', image.name);
  }

  for (const img of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = img[1];
    const src = attr(attrs, 'src') ?? attr(attrs, 'data-src');
    if (!src) continue;
    const alt = attr(attrs, 'alt') ?? attr(attrs, 'title') ?? '';
    if (JUNK.test(alt) || JUNK.test(src)) continue;
    if (!IMAGE_EXT.test(src) && !alt.trim()) continue;
    take(src, 'img', alt.trim() || undefined);
  }

  return found.slice(0, 8);
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
