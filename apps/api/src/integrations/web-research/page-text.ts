export interface PageText {
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  /** Readable body text, block-per-line. */
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: '...',
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1].toLowerCase() === 'x'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ' ';
      try {
        return String.fromCodePoint(code);
      } catch {
        return ' ';
      }
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function meta(html: string, names: readonly string[]): string | null {
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

function jsonLdDate(html: string): string | null {
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const match = block[1].match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (match) return match[1];
  }
  return null;
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Visible text of an HTML page without scripts, navigation, and forms. */
export function extractPageText(html: string): PageText {
  const title =
    meta(html, ['og:title', 'twitter:title']) ??
    (() => {
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return match
        ? decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim()
        : null;
    })();
  const description = meta(html, [
    'og:description',
    'description',
    'twitter:description',
  ]);
  const publishedAt = normalizeDate(
    meta(html, [
      'article:published_time',
      'og:published_time',
      'datePublished',
      'date',
      'pubdate',
      'publishdate',
      'dc.date',
    ]) ??
      jsonLdDate(html) ??
      html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ??
      null,
  );

  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|noscript|svg|template|iframe|nav|footer|form|select|button)\b[\s\S]*?<\/\1>/gi,
      ' ',
    )
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(
      /<\/(p|div|section|article|li|ul|ol|h[1-6]|tr|table|blockquote|header|aside|main|figcaption|dd|dt)>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');
  const text = decodeHtmlEntities(body)
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return { title, description, publishedAt, text };
}

/** The sentence-ish window around the first occurrence of any needle. */
export function excerptAround(
  text: string,
  needles: readonly string[],
  width = 360,
): string | null {
  const lower = text.toLowerCase();
  let best = -1;
  for (const needle of needles) {
    const index = lower.indexOf(needle.toLowerCase());
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  if (best < 0) return null;
  let start = Math.max(0, best - width / 2);
  let end = Math.min(text.length, best + width / 2);
  // Begin and end on word edges so a quote is never cut inside a word.
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < best) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > best) end = space;
  }
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** Whitespace/quote-insensitive form, used to check a quote appears on a page. */
export function foldForQuote(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textContainsQuote(text: string, quote: string): boolean {
  const needle = foldForQuote(quote)
    .replace(/\.\.\.$/, '')
    .trim();
  if (needle.length < 12) return false;
  return foldForQuote(text).includes(needle);
}
