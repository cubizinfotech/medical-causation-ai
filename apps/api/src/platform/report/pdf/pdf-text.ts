/** Width of a string in points, in the font and size being laid out. */
export type MeasureText = (text: string) => number;

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

/** Characters after which a long URL or identifier may break. */
const BREAK_AFTER = new Set(['/', '?', '&', '=', '#', '-', '_', '.', ',', ';']);

/**
 * Splits text into lines no wider than `maxWidth`. Lines break at spaces;
 * a word wider than the line (a long URL) is split, after a URL separator
 * when one falls near the end of the line. Line breaks in the text are kept.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  const space = measure(' ');
  for (const paragraph of printableText(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    let lineWidth = 0;
    for (const word of words) {
      const wordWidth = measure(word);
      if (line && lineWidth + space + wordWidth <= maxWidth) {
        line = `${line} ${word}`;
        lineWidth += space + wordWidth;
        continue;
      }
      if (line) lines.push(line);
      if (wordWidth <= maxWidth) {
        line = word;
        lineWidth = wordWidth;
        continue;
      }
      let rest = word;
      while (measure(rest) > maxWidth) {
        const cut = breakIndex(rest, maxWidth, measure);
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
      lineWidth = measure(rest);
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Where to split a word that does not fit: the longest prefix that fits,
 * moved back to just after a separator in its last third when there is one.
 * Never inside a surrogate pair, and always at least one character.
 */
function breakIndex(
  word: string,
  maxWidth: number,
  measure: MeasureText,
): number {
  let low = 1;
  let high = word.length - 1;
  let fit = 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (measure(word.slice(0, middle)) <= maxWidth) {
      fit = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  for (let index = fit; index > Math.floor((fit * 2) / 3); index--) {
    if (BREAK_AFTER.has(word[index - 1])) return index;
  }
  if (isLowSurrogate(word.charCodeAt(fit)) && fit > 1) return fit - 1;
  return fit;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** The longest start of `text` that fits in `maxWidth`, ending in "…" when cut. */
export function truncateText(
  text: string,
  maxWidth: number,
  measure: MeasureText,
): string {
  if (measure(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && measure(`${text.slice(0, end).trimEnd()}…`) > maxWidth) {
    end--;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}
