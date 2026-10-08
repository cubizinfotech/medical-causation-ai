import type {
  ChronologyDiagnosis,
  ChronologyEvent,
  ChronologyEventType,
} from '../types';
import {
  MIN_READABLE_PAGE_CHARS,
  type CaseRecordPageText,
  type LoadedCaseRecord,
} from './case-record.types';

export interface ChronologyBatch {
  recordId: string;
  documentName: string;
  pages: CaseRecordPageText[];
}

/** An event before it is sorted and given its citation id. */
export type DraftChronologyEvent = Omit<ChronologyEvent, 'id'>;

const EVENT_TYPES: readonly ChronologyEventType[] = [
  'emergency',
  'office_visit',
  'hospital_admission',
  'imaging',
  'lab',
  'procedure',
  'surgery',
  'therapy',
  'medication',
  'other',
];

export const EVENT_TYPE_LABELS: Record<ChronologyEventType, string> = {
  emergency: 'Emergency visit',
  office_visit: 'Office visit',
  hospital_admission: 'Hospital admission',
  imaging: 'Imaging',
  lab: 'Lab result',
  procedure: 'Procedure',
  surgery: 'Surgery',
  therapy: 'Therapy',
  medication: 'Medication',
  other: 'Other',
};

/**
 * Groups readable pages of each record into batches of about maxChars.
 * A batch never spans two records, so every page number stays unambiguous.
 */
export function buildChronologyBatches(
  records: LoadedCaseRecord[],
  maxChars: number,
): ChronologyBatch[] {
  const batches: ChronologyBatch[] = [];
  for (const record of records) {
    let current: CaseRecordPageText[] = [];
    let size = 0;
    for (const page of record.pages) {
      const text = page.text.trim();
      if (text.length < MIN_READABLE_PAGE_CHARS) continue;
      const pageText = text.length > maxChars ? text.slice(0, maxChars) : text;
      if (current.length > 0 && size + pageText.length > maxChars) {
        batches.push({
          recordId: record.id,
          documentName: record.name,
          pages: current,
        });
        current = [];
        size = 0;
      }
      current.push({ ...page, text: pageText });
      size += pageText.length;
    }
    if (current.length > 0) {
      batches.push({
        recordId: record.id,
        documentName: record.name,
        pages: current,
      });
    }
  }
  return batches;
}

export function formatBatchPages(batch: ChronologyBatch): string {
  return batch.pages
    .map((page) => `=== Page ${page.pageNumber} ===\n${page.text}`)
    .join('\n\n');
}

/** Reads {"events": [...]} (or a bare array) out of the model's reply. */
export function parseChronologyResponse(content: string): unknown[] {
  const start = content.search(/[[{]/);
  if (start < 0) throw new Error('No JSON in chronology response');
  const closer = content[start] === '{' ? '}' : ']';
  const end = content.lastIndexOf(closer);
  if (end <= start) throw new Error('Incomplete JSON in chronology response');
  const parsed: unknown = JSON.parse(content.slice(start, end + 1));
  if (Array.isArray(parsed)) return parsed;
  const events = (parsed as { events?: unknown } | null)?.events;
  if (Array.isArray(events)) return events;
  throw new Error('Chronology response has no events list');
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function quoteFoundOn(quote: string, pageText: string): boolean {
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length < 8) return false;
  const normalizedPage = normalizeForMatch(pageText);
  if (normalizedPage.includes(normalizedQuote)) return true;
  // Tolerate small OCR-style or wrapping differences: most words present.
  const words = normalizedQuote.split(' ').filter((w) => w.length > 2);
  if (words.length < 4) return false;
  const pageWords = new Set(normalizedPage.split(' '));
  const found = words.filter((word) => pageWords.has(word)).length;
  return found / words.length >= 0.85;
}

/**
 * The page the quote is really on: the claimed page first, then the other
 * pages of the batch (the model sometimes cites a neighbouring page).
 */
export function locateQuote(
  quote: string,
  batch: ChronologyBatch,
  claimedPage: number,
): number | null {
  const ordered = [
    ...batch.pages.filter((p) => p.pageNumber === claimedPage),
    ...batch.pages.filter((p) => p.pageNumber !== claimedPage),
  ];
  return (
    ordered.find((page) => quoteFoundOn(quote, page.text))?.pageNumber ?? null
  );
}

const ICD10_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.?[0-9A-Z]{1,4})?$/i;

/** An ICD-10 code survives only if it is printed on the cited page. */
export function verifiedIcd10(
  code: unknown,
  pageText: string,
): string | undefined {
  if (typeof code !== 'string') return undefined;
  const trimmed = code.trim().toUpperCase();
  if (!ICD10_PATTERN.test(trimmed)) return undefined;
  return compact(pageText).includes(compact(trimmed)) ? trimmed : undefined;
}

/** YYYY-MM-DD, YYYY-MM or YYYY; US M/D/YYYY is converted; else "". */
export function normalizeEventDate(value: unknown, now = new Date()): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  const maxYear = now.getFullYear() + 1;
  const validYear = (y: number) => y >= 1900 && y <= maxYear;
  const pad = (n: number) => String(n).padStart(2, '0');

  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(y, m - 1, d));
    return validYear(y) &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d
      ? raw
      : '';
  }
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (match) {
    return normalizeEventDate(
      `${match[3]}-${pad(Number(match[1]))}-${pad(Number(match[2]))}`,
      now,
    );
  }
  match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (match) {
    const month = Number(match[2]);
    return validYear(Number(match[1])) && month >= 1 && month <= 12 ? raw : '';
  }
  match = /^(\d{4})$/.exec(raw);
  return match && validYear(Number(match[1])) ? raw : '';
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function cleanList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Turns the model's events into trusted drafts. Events must point at a page
 * in this batch; quotes are checked against the page text; codes and dates
 * that cannot be verified are dropped, never guessed.
 */
export function validateChronologyEvents(
  raw: unknown[],
  batch: ChronologyBatch,
  now = new Date(),
): DraftChronologyEvent[] {
  const pagesByNumber = new Map(batch.pages.map((p) => [p.pageNumber, p]));
  const drafts: DraftChronologyEvent[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const event = item as Record<string, unknown>;
    const summary = cleanText(event.summary, 500);
    if (!summary) continue;

    const claimedPage = Number(event.page);
    const quote = cleanText(event.quote, 300);
    const quotePage = quote ? locateQuote(quote, batch, claimedPage) : null;
    const pageNumber =
      quotePage ?? (pagesByNumber.has(claimedPage) ? claimedPage : null);
    if (pageNumber === null) continue;
    const page = pagesByNumber.get(pageNumber)!;

    const type = EVENT_TYPES.includes(event.type as ChronologyEventType)
      ? (event.type as ChronologyEventType)
      : 'other';

    const diagnoses: ChronologyDiagnosis[] = Array.isArray(event.diagnoses)
      ? event.diagnoses
          .map((dx: unknown): ChronologyDiagnosis | null => {
            const record =
              dx && typeof dx === 'object'
                ? (dx as Record<string, unknown>)
                : { description: dx };
            const description = cleanText(record.description, 200);
            if (!description) return null;
            const icd10 = verifiedIcd10(record.icd10, page.text);
            return icd10 ? { description, icd10 } : { description };
          })
          .filter((dx): dx is ChronologyDiagnosis => dx !== null)
          .slice(0, 8)
      : [];

    drafts.push({
      date: normalizeEventDate(event.date, now),
      type,
      provider: cleanText(event.provider, 120) || undefined,
      facility: cleanText(event.facility, 160) || undefined,
      summary,
      diagnoses,
      treatments: cleanList(event.treatments, 8, 160),
      medications: cleanList(event.medications, 10, 160),
      recordId: batch.recordId,
      documentName: batch.documentName,
      pageNumber,
      batesNumbers: page.batesNumbers,
      quote,
      quoteVerified: quotePage !== null,
    });
  }
  return drafts;
}

/**
 * Sorts by date (undated events last, in document order), removes
 * duplicates, and assigns citation ids rec-1, rec-2, ...
 */
export function finalizeChronology(
  drafts: DraftChronologyEvent[],
  recordOrder: string[],
): ChronologyEvent[] {
  const seen = new Set<string>();
  const unique = drafts.filter((event) => {
    const key = [
      event.recordId,
      event.date,
      event.type,
      normalizeForMatch(event.summary).slice(0, 80),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const position = (event: DraftChronologyEvent) =>
    recordOrder.indexOf(event.recordId) * 100000 + event.pageNumber;
  unique.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return position(a) - position(b);
  });

  return unique.map((event, index) => ({ id: `rec-${index + 1}`, ...event }));
}

export function recordCitationText(event: ChronologyEvent): string {
  const bates = event.batesNumbers.length
    ? `, Bates ${event.batesNumbers.join(', ')}`
    : '';
  return `[Record: ${event.documentName}, p. ${event.pageNumber}${bates}]`;
}

function promptLine(event: ChronologyEvent): string {
  const where = [event.facility, event.provider].filter(Boolean).join(', ');
  const dx = event.diagnoses
    .map((d) => (d.icd10 ? `${d.description} (${d.icd10})` : d.description))
    .join('; ');
  return [
    `- ${event.id}`,
    event.date || 'date not stated',
    EVENT_TYPE_LABELS[event.type],
    where,
    event.summary,
    dx ? `Dx: ${dx}` : '',
    event.treatments.length ? `Tx: ${event.treatments.join('; ')}` : '',
    event.medications.length ? `Meds: ${event.medications.join('; ')}` : '',
    event.quote ? `Quote: "${event.quote}"` : '',
    recordCitationText(event),
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * The chronology as the analysis prompt sees it. When it is too long, the
 * events that mention the case's diagnosis or question terms are kept first;
 * the kept events stay in date order.
 */
export function formatChronologyForPrompt(
  events: ChronologyEvent[],
  maxChars: number,
  focusTerms: string[],
): { text: string; includedIds: string[]; omitted: number } {
  const lines = events.map((event) => ({ event, line: promptLine(event) }));
  const total = lines.reduce((sum, l) => sum + l.line.length + 1, 0);
  let kept = lines;

  if (total > maxChars) {
    const terms = focusTerms
      .map((term) => normalizeForMatch(term))
      .filter((term) => term.length > 3);
    const score = (line: string) => {
      const text = normalizeForMatch(line);
      return terms.filter((term) => text.includes(term)).length;
    };
    const ranked = [...lines].sort((a, b) => score(b.line) - score(a.line));
    const chosen = new Set<string>();
    let size = 0;
    for (const item of ranked) {
      if (size + item.line.length + 1 > maxChars) continue;
      chosen.add(item.event.id);
      size += item.line.length + 1;
    }
    kept = lines.filter((item) => chosen.has(item.event.id));
  }

  return {
    text: kept.map((item) => item.line).join('\n'),
    includedIds: kept.map((item) => item.event.id),
    omitted: lines.length - kept.length,
  };
}
