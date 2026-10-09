import type { ChronologyEvent } from '../types';
import { formatEventDateLong } from './letter-format';

/** Entries listed when the narrative falls back to the chronology itself. */
const MAX_LISTED_EVENTS = 40;

/** Reads {"paragraphs": [...]} out of the model's reply. */
export function parseNarrative(content: string): string[] {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON in narrative reply');
  const parsed = JSON.parse(content.slice(start, end + 1)) as {
    paragraphs?: unknown;
  };
  if (!Array.isArray(parsed.paragraphs)) {
    throw new Error('Narrative reply has no paragraphs');
  }
  return parsed.paragraphs
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Dates the text mentions, as YYYY-MM-DD or YYYY-MM. */
function mentionedDates(text: string): string[] {
  const dates: string[] = [];
  const pad = (value: number) => String(value).padStart(2, '0');
  for (const match of text.matchAll(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:(\d{1,2}),?\s+)?(\d{4})\b/gi,
  )) {
    const month = pad(MONTHS.indexOf(match[1].toLowerCase()) + 1);
    dates.push(
      match[2]
        ? `${match[3]}-${month}-${pad(Number(match[2]))}`
        : `${match[3]}-${month}`,
    );
  }
  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    dates.push(`${match[3]}-${pad(Number(match[1]))}-${pad(Number(match[2]))}`);
  }
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    dates.push(match[0]);
  }
  return dates;
}

export type NarrativeCheck = { ok: true } | { ok: false; reason: string };

/**
 * The draft is used only if every sentence it relies on is traceable: each
 * paragraph cites known entries, and every date and ICD-10 code it mentions
 * appears in those entries (or is the date of the incident).
 */
export function checkNarrative(
  paragraphs: string[],
  events: ChronologyEvent[],
  dateOfLoss: string,
): NarrativeCheck {
  if (paragraphs.length === 0 || paragraphs.length > 8) {
    return { ok: false, reason: `${paragraphs.length} paragraphs` };
  }
  const ids = new Set(events.map((event) => event.id));
  const knownDates = new Set<string>();
  for (const date of [...events.map((event) => event.date), dateOfLoss]) {
    if (!date) continue;
    knownDates.add(date);
    knownDates.add(date.slice(0, 7));
  }
  const knownCodes = new Set(
    events.flatMap((event) =>
      event.diagnoses
        .map((dx) => dx.icd10?.toUpperCase())
        .filter((code): code is string => Boolean(code)),
    ),
  );

  for (const paragraph of paragraphs) {
    if (paragraph.length > 2000) return { ok: false, reason: 'too long' };
    const cited = [...paragraph.matchAll(/\[(rec-\d+)\]/g)].map((m) => m[1]);
    if (cited.length === 0) {
      return { ok: false, reason: 'a paragraph cites no entry' };
    }
    const unknown = cited.find((id) => !ids.has(id));
    if (unknown) return { ok: false, reason: `unknown entry ${unknown}` };
    if (/\$\s?\d/.test(paragraph)) {
      return { ok: false, reason: 'mentions a dollar amount' };
    }
    const strayDate = mentionedDates(paragraph).find(
      (date) => !knownDates.has(date),
    );
    if (strayDate) return { ok: false, reason: `date ${strayDate}` };
    const strayCode = [
      ...paragraph.matchAll(/\b[A-TV-Z]\d{2}\.[0-9A-Z]{1,4}\b/g),
    ].find((match) => !knownCodes.has(match[0].toUpperCase()));
    if (strayCode) return { ok: false, reason: `code ${strayCode[0]}` };
  }
  return { ok: true };
}

/** "St Mary ER records.pdf" p. 3 -> "St Mary ER records, p. 3". */
export function citationFor(event: ChronologyEvent): string {
  const document = event.documentName.replace(/\.pdf$/i, '');
  const bates = event.batesNumbers.length
    ? `, Bates ${event.batesNumbers.join(', ')}`
    : '';
  return `${document}, p. ${event.pageNumber}${bates}`;
}

/**
 * Turns [rec-N] markers into record citations: "...on August 14 [rec-1]."
 * becomes "...on August 14 (ER records, p. 3)." A citation that repeats the
 * one just before it is written "(Id.)".
 */
export function renderCitations(
  text: string,
  eventsById: Map<string, ChronologyEvent>,
): string {
  let previous = '';
  const cite = (group: string) => {
    const ids = [...new Set([...group.matchAll(/rec-\d+/g)].map((m) => m[0]))];
    const parts = [
      ...new Set(
        ids
          .map((id) => eventsById.get(id))
          .filter((event): event is ChronologyEvent => Boolean(event))
          .map(citationFor),
      ),
    ];
    if (parts.length === 0) return '';
    const full = parts.join('; ');
    const written = full === previous ? 'Id.' : full;
    previous = full;
    return ` (${written})`;
  };
  // One pass, left to right, so "Id." follows the reading order. A marker
  // after the end of a sentence moves before its period.
  return text
    .replace(
      /([.!?])?\s*((?:\[rec-\d+\]\s*)+)/g,
      (_, mark: string | undefined, group: string) =>
        `${cite(group)}${mark ?? ''} `,
    )
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Without a usable AI draft: the chronology itself, one dated paragraph per
 * entry, each cited to its page.
 */
export function chronologyNarrative(events: ChronologyEvent[]): string[] {
  const listed = events
    .filter((event) => event.type !== 'other')
    .slice(0, MAX_LISTED_EVENTS);
  const paragraphs = listed.map((event) => {
    const where = [event.facility, event.provider].filter(Boolean).join(', ');
    const when = event.date ? formatEventDateLong(event.date) : 'Undated';
    const summary = event.summary.replace(/\s*\.?\s*$/, '');
    return `${when}${where ? ` — ${where}` : ''}: ${summary} (${citationFor(event)}).`;
  });
  const remaining = events.length - listed.length;
  if (remaining > 0) {
    paragraphs.push(
      `Further treatment is documented in the enclosed records (${remaining} more ${remaining === 1 ? 'entry' : 'entries'}).`,
    );
  }
  return paragraphs;
}
