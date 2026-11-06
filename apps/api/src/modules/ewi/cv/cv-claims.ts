import {
  articleTitle,
  classifyPublicationType,
  normalizeDoi,
  parsePmid,
  parseYear,
  stateCode,
} from '@integrations/expert-research';
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
    for (const pageText of splitPageText(text, maxChars)) {
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
  }
  if (current.length > 0) batches.push({ pages: current });
  return batches;
}

/** Splits a long page so the remainder is still read, not silently dropped. */
export function splitPageText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf('\n'),
        window.lastIndexOf('. '),
      );
      if (breakAt > maxChars * 0.4) end = start + breakAt + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }
  return chunks;
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
    'doi',
    'pmid',
    'publicationType',
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

const PUBLICATION_HEADING =
  /\b(PUBLICATIONS|PEER-REVIEWED PUBLICATIONS|JOURNAL ARTICLES|BOOK CHAPTERS|PUBLISHED ABSTRACTS|OTHER PRESENTATIONS|POSTERS|PRESENTATIONS)\b/i;
const PUBLICATION_STOP =
  /\b(PROFESSION-RELATED|CLASSROOM TEACHING|OTHER WORK EXPERIENCE|LICENSURE|BOARD CERTIFICATION|MEMBERSHIPS|HONORS|AWARDS)\b/i;

/**
 * Numbered bibliography entries. These stay even when the AI pass misses
 * them. Type comes from the nearest heading; abstracts and chapters are
 * kept and labelled, not treated as journal articles.
 */
export function extractBibliographyClaims(
  pages: Array<{ pageNumber: number; text: string }>,
): Array<Omit<CvClaim, 'id'>> {
  const claims: Array<Omit<CvClaim, 'id'>> = [];
  let heading: string | undefined;
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const stop = text.search(PUBLICATION_STOP);
    const limited = stop > 0 ? text.slice(0, stop) : text;
    const sections = splitBibliographySections(limited, heading);
    heading = sections.at(-1)?.heading ?? heading;
    if (stop > 0) heading = undefined;
    for (const section of sections) {
      const entries = section.body.split(/(?:^|\s)(?=\d{1,3}\.\s)/);
      for (const entry of entries) {
        const cleaned = entry.replace(/^\d{1,3}\.\s*/, '').trim();
        if (cleaned.length < 40) continue;
        if (!/\b(?:19|20)\d{2}\b/.test(cleaned)) continue;
        const quote = cleaned.slice(0, 180);
        if (!quoteOnPage(quote, page.text)) continue;
        const type = classifyPublicationType(cleaned, section.heading);
        const journal = cleaned.match(/\b([A-Z][A-Za-z& ]{2,60}),\s+\d/)?.[1];
        const year = parseYear(cleaned);
        const doi = normalizeDoi(cleaned);
        const pmid = parsePmid(cleaned);
        claims.push({
          category: 'publication',
          statement: cleaned.slice(0, 300),
          details: {
            title: articleTitle(cleaned).slice(0, 240),
            ...(journal ? { journal: journal.trim() } : {}),
            ...(year ? { year: String(year) } : {}),
            ...(doi ? { doi } : {}),
            ...(pmid ? { pmid } : {}),
            publicationType: type,
          },
          page: page.pageNumber,
          quote,
        });
      }
    }
  }
  return claims;
}

function splitBibliographySections(
  text: string,
  previousHeading?: string,
): Array<{ heading?: string; body: string }> {
  const matches = [...text.matchAll(new RegExp(PUBLICATION_HEADING, 'gi'))];
  if (matches.length === 0) {
    return previousHeading ? [{ heading: previousHeading, body: text }] : [];
  }
  const sections: Array<{ heading?: string; body: string }> = [];
  const firstStart = matches[0].index ?? 0;
  if (firstStart > 0 && previousHeading) {
    sections.push({
      heading: previousHeading,
      body: text.slice(0, firstStart),
    });
  }
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    sections.push({
      heading: match[1],
      body: text.slice(start, end),
    });
  }
  return sections;
}

/** Removes repeats, caps long publication lists, and assigns ids. */
export function finalizeCvClaims(
  drafts: Array<Omit<CvClaim, 'id'>>,
): CvClaim[] {
  const seen = new Set<string>();
  let publications = 0;
  const kept: Array<Omit<CvClaim, 'id'>> = [];
  for (const claim of drafts) {
    if (isJunkCvClaim(claim)) continue;
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

/**
 * Drop CV title blocks, contact headers, multi-entry dumps, and associate bios.
 * Shared by finalize and leftover comparison so filtered claims are not
 * re-emitted as Self-Reported.
 */
export function isJunkCvClaim(claim: Omit<CvClaim, 'id'>): boolean {
  const hay = `${claim.statement} ${claim.quote} ${claim.details.title ?? ''}`.toLowerCase();
  if (
    /\b(curriculum vitae|personal information|business address|business telephone|business facsimile|e-?mail address)\b/.test(
      hay,
    )
  ) {
    return true;
  }
  if (claim.category === 'publication') {
    if (/\bpublications in peer reviewed\b/.test(hay)) return true;
    if (/\bpage \d+\b/.test(hay) && hay.length > 280) return true;
    if ((hay.match(/\b(?:19|20)\d{2}\b/g) ?? []).length >= 3) return true;
    if (/authored a publication\.?$/.test(hay)) return true;
    // Associate bios mis-tagged as publications — keep bibliographic co-authorship.
    if (
      /\b(dr\.?\s+glass|leila\s+glass)\b/i.test(hay) &&
      /\b(honored|graduated|her published|nih grants|dr\.?\s+glass was|in addition, dr\.?\s+glass)\b/i.test(
        hay,
      )
    ) {
      return true;
    }
  }
  if (
    claim.category === 'education' &&
    !/\b(b\.?a\.?|b\.?s\.?|m\.?a\.?|m\.?s\.?|ph\.?d\.?|m\.?d\.?|psy\.?d\.?|degree|university|college|internship|residency|fellowship)\b/i.test(
      hay,
    )
  ) {
    return true;
  }
  // Extractor sometimes dumps whole CV credential blocks into membership/board.
  if (
    (claim.category === 'membership' ||
      claim.category === 'board_certification' ||
      claim.category === 'license') &&
    hay.length > 220 &&
    (/\blicensure\b/.test(hay) ||
      ((hay.match(/\b(?:19|20)\d{2}\b/g) ?? []).length >= 3 &&
        /\b(diplomate|board certified|psychologist,? psy)\b/.test(hay)))
  ) {
    return true;
  }
  // Associate bio claims (not bibliographic co-authorship).
  if (
    claim.category !== 'publication' &&
    /\b(dr\.?\s+glass|leila\s+glass)\b/i.test(hay)
  ) {
    return true;
  }
  return false;
}

const DEGREE_LINE =
  /\b((?:Ph\.?\s*D\.?|Psy\.?\s*D\.?|M\.?\s*D\.?|M\.?\s*A\.?|M\.?\s*S\.?|B\.?\s*A\.?|B\.?\s*S\.?|Ed\.?\s*D\.?|D\.?\s*O\.?)[^.\n]{0,120}?(?:University|College|Institute|School)[^.\n]{0,80})/gi;

const LICENSE_LINE =
  /\b((?:Licensed|License)\s+[A-Za-z ]{3,40}(?:Psychologist|Physician|Nurse|Counselor)?[^.\n]{0,80}(?:#\s*\d{3,}|\b[A-Z]{2}\b)?[^.\n]{0,40})/gi;

const BOARD_LINE =
  /\b((?:Board[- ]Certified|Diplomate|Diplomate of|Certified by)\s[^.\n]{8,120})/gi;

const MEMBERSHIP_LINE =
  /\b((?:Member|Fellow|Member of|Membership)\s+(?:of\s+)?(?:the\s+)?[A-Z][^.\n]{8,100})/gi;

const APPOINTMENT_LINE =
  /\b((?:Clinical|Assistant|Associate|Adjunct|Full|Visiting)?\s*(?:Professor|Faculty|Instructor|Attending|Director|Chief)\b\s*[,:\-]?\s*[^.\n]{4,140})/gi;

/** Practicum / internship / residency / fellowship training sites. */
const TRAINING_LINE =
  /\b((?:Predoctoral|Postdoctoral|Clinical)?\s*(?:Practicum|Internship|Intern(?:ship)?|Externship|Residency|Fellowship|Clinical training)\s*[,:\-]?\s*[^.\n]{4,140})/gi;

const TRAINING_DOMINANT =
  /\b(practicum|internship|intern\b|externship|residency|fellowship|clinical training|training site|site supervisor)\b/i;

/**
 * Heuristic claims from CV body text when AI extraction is unavailable
 * (public website / Drive PDFs). Does not invent missing dates or fields.
 */
export function extractStructuredClaimsFromCvText(
  text: string,
  page = 1,
): Array<Omit<CvClaim, 'id'>> {
  const claims: Array<Omit<CvClaim, 'id'>> = [];
  const seen = new Set<string>();
  const push = (
    category: CvClaimCategory,
    statement: string,
    details: CvClaimDetails = {},
  ) => {
    const cleaned = statement.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 12 || cleaned.length > 400) return;
    const key = `${category}|${normalizeForMatch(cleaned)}`;
    if (seen.has(key)) return;
    seen.add(key);
    claims.push({
      category,
      statement: cleaned.slice(0, 300),
      details,
      page,
      quote: cleaned.slice(0, 180),
    });
  };

  for (const match of text.matchAll(DEGREE_LINE)) {
    const statement = match[1];
    const year = parseYear(statement);
    const degree = statement.match(
      /\b(Ph\.?\s*D\.?|Psy\.?\s*D\.?|M\.?\s*D\.?|M\.?\s*A\.?|M\.?\s*S\.?|B\.?\s*A\.?|B\.?\s*S\.?|Ed\.?\s*D\.?|D\.?\s*O\.?)/i,
    )?.[1];
    const institution = statement.match(
      /\b([A-Z][^,]{2,80}?(?:University|College|Institute|School)[^,]{0,40})/,
    )?.[1];
    push('education', statement, {
      ...(degree ? { degree: degree.replace(/\s+/g, '') } : {}),
      ...(institution ? { institution: institution.trim() } : {}),
      ...(year ? { year: String(year) } : {}),
    });
  }
  for (const match of text.matchAll(LICENSE_LINE)) {
    const statement = match[1];
    const state = stateCode(statement);
    const licenseNumber = statement.match(/#\s*([A-Z0-9-]{3,})/i)?.[1];
    push('license', statement, {
      ...(state ? { state } : {}),
      ...(licenseNumber ? { licenseNumber } : {}),
    });
  }
  for (const match of text.matchAll(BOARD_LINE)) {
    push('board_certification', match[1], { board: match[1].slice(0, 120) });
  }
  for (const match of text.matchAll(MEMBERSHIP_LINE)) {
    push('membership', match[1], { name: match[1].slice(0, 120) });
  }
  // Prefer training over appointment when training cues dominate.
  for (const match of text.matchAll(TRAINING_LINE)) {
    const statement = match[1];
    const institution = statement.match(
      /\b([A-Z][^,]{2,80}?(?:University|College|Institute|School|Hospital|Medical Center|Clinic)[^,]{0,40})/,
    )?.[1];
    push('training', statement, {
      title: statement.slice(0, 120),
      ...(institution ? { institution: institution.trim() } : {}),
    });
  }
  for (const match of text.matchAll(APPOINTMENT_LINE)) {
    const statement = match[1];
    if (TRAINING_DOMINANT.test(statement)) {
      // Already captured (or should be) as training — do not double-file as appointment.
      continue;
    }
    const institution = statement.match(
      /\b([A-Z][^,]{2,80}?(?:University|College|Institute|School|Hospital|Medical Center)[^,]{0,40})/,
    )?.[1];
    push('appointment', statement, {
      title: statement.slice(0, 120),
      ...(institution ? { institution: institution.trim() } : {}),
    });
  }

  const bib = extractBibliographyClaims([{ pageNumber: page, text }]);
  for (const claim of bib) {
    const key = `${claim.category}|${normalizeForMatch(claim.details.title ?? claim.statement)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push(claim);
  }
  return claims.slice(0, MAX_CLAIMS);
}

/** True when page text looks like a curriculum vitae / resume body. */
export function textLooksLikeCurriculumVitae(text: string): boolean {
  const head = text.slice(0, 3500).toLowerCase();
  if (/\b(curriculum vitae|\bcv\b|resume|résumé)\b/.test(head)) return true;
  const cues = [
    /\beducation\b/,
    /\blicensure\b|\blicense\b/,
    /\bboard certification\b/,
    /\bpublications\b/,
    /\bprofessional experience\b|\bemployment\b/,
    /\bmemberships?\b/,
  ];
  return cues.filter((pattern) => pattern.test(head)).length >= 3;
}
