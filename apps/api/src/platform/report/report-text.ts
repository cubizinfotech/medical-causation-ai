/** Text helpers shared by the PDF and Word report renderers. */

// Control characters (other than line breaks) and zero-width marks have no
// glyph and would print as boxes.
const INVISIBLE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u2028\u2029\ufeff]/g;

/** Text as it can be printed: line breaks normalized, invisible marks removed. */
export function printableText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(INVISIBLE, '');
}

/**
 * Only web and mail links become clickable. Source URLs come from outside
 * services; any other scheme is printed as plain text.
 */
export function safeLink(link: string | undefined): string | undefined {
  const value = link?.trim();
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' ||
      protocol === 'https:' ||
      protocol === 'mailto:'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Bytes of a data:image URL, or null when it is not a usable image. */
export function decodeDataUrlImage(dataUrl: string | undefined): Buffer | null {
  if (!dataUrl?.startsWith('data:image/')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  try {
    const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
    return bytes.length > 32 ? bytes : null;
  } catch {
    return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** "Photo from clinic.example" for a cover caption. */
export function photoSourceLabel(sourceUrl: string | undefined): string | null {
  const host = sourceUrl ? hostOf(sourceUrl) : null;
  return host ? `Photo from ${host}` : null;
}

/** "Oct 15, 2026, 9:10 AM UTC". The server's time zone is not the reader's. */
export function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`;
}
