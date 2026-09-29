/**
 * Detect Bates stamp numbers from extracted text.
 * Only returns matches found in the text — never fabricates numbers.
 *
 * Common patterns:
 * - PREFIX000123 / PREFIX-000123 / PREFIX_000123
 * - Bates: ABC 000123
 * - BA Bates No. 12345
 */

const BATES_PATTERNS: RegExp[] = [
  // PREFIX + optional separator + 4–10 digits (e.g. ACME000123, ACME-000123)
  /\b([A-Z]{2,12})[-_ ]?(\d{4,10})\b/g,
  // Explicit Bates labels
  /\bBates(?:\s+(?:No\.?|Number|#))?\s*[:#]?\s*([A-Z]{0,12}[-_ ]?\d{4,10})\b/gi,
  // Page-corner style with leading zeros already captured above
];

/** Reject common false positives that look numeric but are not Bates. */
const FALSE_POSITIVE = new Set([
  'HTTP',
  'HTTPS',
  'PAGE',
  'ISBN',
  'ISSN',
  'PMID',
  'DOI',
  'COVID',
  'HTML',
  'JSON',
  'UTF',
]);

export function detectBatesNumbers(text: string): string[] {
  if (!text?.trim()) return [];
  const found = new Set<string>();

  for (const pattern of BATES_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const normalized = normalizeBatesMatch(match);
      if (normalized) found.add(normalized);
    }
  }

  return [...found].sort();
}

function normalizeBatesMatch(match: RegExpExecArray): string | null {
  // Pattern with prefix + digits groups
  if (match[1] && match[2] && /^\d{4,10}$/.test(match[2])) {
    const prefix = match[1].toUpperCase();
    if (FALSE_POSITIVE.has(prefix)) return null;
    if (/^\d+$/.test(prefix)) return null;
    return `${prefix}${match[2]}`;
  }

  // Explicit "Bates: VALUE" group
  const labeled = (match[1] ?? '').toUpperCase().replace(/[\s_]+/g, '');
  if (!labeled) return null;
  if (!/[A-Z]{0,12}\d{4,10}/.test(labeled)) return null;
  const prefix = labeled.replace(/\d+$/, '');
  if (prefix && FALSE_POSITIVE.has(prefix)) return null;
  return labeled.replace(/-/g, '');
}

/**
 * Attach detected Bates numbers onto pages without inventing values.
 */
export function attachBatesToPages<
  T extends { text: string; batesNumbers?: string[] },
>(pages: T[]): T[] {
  return pages.map((page) => ({
    ...page,
    batesNumbers: detectBatesNumbers(page.text),
  }));
}
