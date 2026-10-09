import { stateCode } from '@integrations/expert-research';
import type { LoadedExpertDocument } from '../documents/expert-documents.types';
import {
  CV_CLAIM_CATEGORIES,
  type CvClaim,
  type CvClaimCategory,
  type CvClaimDetails,
} from './cv.types';

/** Pages with less text than this are skipped. */
const MIN_PAGE_CHARS = 30;
/** Publication titles kept from one CV (the comparison checks up to 25). */
const MAX_PUBLICATION_CLAIMS = 40;
const MAX_CLAIMS = 160;

export interface CvBatch {
  pages: Array<{ pageNumber: number; text: string; ocr: boolean }>;
}

/** Groups readable pages into batches of about maxChars. */
export function buildCvBatches(
  document: LoadedExpertDocument,
  maxChars: number,
): CvBatch[] {
  const batches: CvBatch[] = [];
  let current: CvBatch['pages'] = [];
  let size = 0;
  for (const page of document.pages) {
    const text = page.text.trim();
    if (text.length < MIN_PAGE_CHARS) continue;
    const pageText = text.length > maxChars ? text.slice(0, maxChars) : text;
    if (current.length > 0 && size + pageText.length > maxChars) {
      batches.push({ pages: current });
      current = [];
      size = 0;
    }
    current.push({
      pageNumber: page.pageNumber,
      text: pageText,
      ocr: page.ocrConfidence != null,
    });
    size += pageText.length;
  }
  if (current.length > 0) batches.push({ pages: current });
  return batches;
}

export function formatCvBatch(batch: CvBatch): string {
  return batch.pages
    .map((page) =>
      page.ocr
        ? `=== Page ${page.pageNumber} ===\n[Scanned page: text read by OCR; it may contain reading errors.]\n${page.text}`
        : `=== Page ${page.pageNumber} ===\n${page.text}`,
    )
    .join('\n\n');
}

/** Reads {"claims": [...]} (or a bare array) out of the model's reply. */
export function parseCvReply(content: string): unknown[] {
  const start = content.search(/[[{]/);
  const end = Math.max(content.lastIndexOf('}'), content.lastIndexOf(']'));
  if (start === -1 || end <= start) throw new Error('CV reply has no JSON');
  const parsed: unknown = JSON.parse(content.slice(start, end + 1));
  if (Array.isArray(parsed)) return parsed;
  const claims = (parsed as { claims?: unknown } | null)?.claims;
  if (Array.isArray(claims)) return claims;
  throw new Error('CV reply has no claims list');
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The quote is on the page, word for word or with small spacing differences. */
export function quoteOnPage(quote: string, pageText: string): boolean {
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length < 6) return false;
  const normalizedPage = normalizeForMatch(pageText);
  if (normalizedPage.includes(normalizedQuote)) return true;
  const words = normalizedQuote.split(' ').filter((word) => word.length > 2);
  if (words.length < 4) return false;
  const pageWords = new Set(normalizedPage.split(' '));
  return (
    words.filter((word) => pageWords.has(word)).length / words.length >= 0.85
  );
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function count(value: unknown): number | undefined {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/[^0-9.]/g, ''))
        : NaN;
  return Number.isFinite(number) && number >= 0 && number < 100000
    ? Math.round(number)
    : undefined;
}

function percent(value: unknown): number | undefined {
  const number = count(value);
  return number !== undefined && number <= 100 ? number : undefined;
}

function cleanDetails(raw: unknown): CvClaimDetails {
  const details =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: CvClaimDetails = {};
  const stateText = text(details.state, 40);
  const state = stateText ? stateCode(stateText) : null;
  if (state) result.state = state;
  for (const key of [
    'licenseNumber',
    'board',
    'specialty',
    'year',
    'status',
    'institution',
    'title',
    'degree',
    'journal',
    'company',
    'role',
    'name',
  ] as const) {
    const value = text(details[key], key === 'title' ? 300 : 200);
    if (value) result[key] = value;
  }
  const claimedCount = count(details.count);
  if (claimedCount !== undefined) result.count = claimedCount;
  const plaintiff = percent(details.plaintiffPercent);
  if (plaintiff !== undefined) result.plaintiffPercent = plaintiff;
  const defense = percent(details.defensePercent);
  if (defense !== undefined) result.defensePercent = defense;
  return result;
}

/**
 * Keeps only claims whose quote is found on a page of the batch; the page
 * number is corrected when the quote is on a neighbouring page.
 */
export function validateCvClaims(
  raw: unknown[],
  batch: CvBatch,
): Array<Omit<CvClaim, 'id'>> {
  const kept: Array<Omit<CvClaim, 'id'>> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const claim = item as Record<string, unknown>;
    const category = claim.category as CvClaimCategory;
    if (!CV_CLAIM_CATEGORIES.includes(category)) continue;
    const statement = text(claim.statement, 300);
    const quote = text(claim.quote, 300);
    if (!statement || !quote) continue;
    const claimed = Number(claim.page);
    const ordered = [
      ...batch.pages.filter((page) => page.pageNumber === claimed),
      ...batch.pages.filter((page) => page.pageNumber !== claimed),
    ];
    const page = ordered.find((candidate) =>
      quoteOnPage(quote, candidate.text),
    );
    if (!page) continue;
    kept.push({
      category,
      statement,
      details: cleanDetails(claim.details),
      page: page.pageNumber,
      quote,
    });
  }
  return kept;
}

/** Removes repeats, caps long publication lists, and assigns ids. */
export function finalizeCvClaims(
  drafts: Array<Omit<CvClaim, 'id'>>,
): CvClaim[] {
  const seen = new Set<string>();
  let publications = 0;
  const kept: Array<Omit<CvClaim, 'id'>> = [];
  for (const claim of drafts) {
    const key = `${claim.category}|${normalizeForMatch(claim.details.title ?? claim.statement)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (claim.category === 'publication') {
      publications += 1;
      if (publications > MAX_PUBLICATION_CLAIMS) continue;
    }
    kept.push(claim);
    if (kept.length >= MAX_CLAIMS) break;
  }
  return kept.map((claim, index) => ({ id: `cv-${index + 1}`, ...claim }));
}
