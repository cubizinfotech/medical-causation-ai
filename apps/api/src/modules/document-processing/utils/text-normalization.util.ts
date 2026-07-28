import { CHARS_PER_TOKEN_ESTIMATE } from '../constants';

/**
 * Normalize whitespace, unicode, line endings, and invisible characters.
 * Preserves paragraph breaks (double newlines).
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  const normalized = text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove zero-width and BOM characters
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // Normalize unicode spaces to regular space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Collapse horizontal whitespace (preserve newlines)
    .replace(/[^\S\n]+/g, ' ')
    // Trim trailing spaces on each line
    .replace(/ +$/gm, '')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized;
}

/**
 * Count words in text.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Estimate token count from character length.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Derive a title from filename when not available in document metadata.
 */
export function deriveTitle(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '');
  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Join page texts preserving page boundaries as double newlines.
 */
export function joinPageTexts(pages: Array<{ text: string }>): string {
  return pages
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n');
}
