import { decodeHtmlEntities } from './page-text';
import { isGoogleDriveFileUrl } from './google-drive';

/** A document link that may be the expert's CV or resume. */
export interface CvLinkCandidate {
  url: string;
  /** Visible link text (decoded). */
  text: string;
  score: number;
  /** Why the link was accepted (for logs / debugging). */
  reason: string;
}

const CV_TEXT =
  /\b(curriculum\s+vitae|\bc\.?\s*v\.?\b|resume|résumé|download\s+(?:my\s+)?(?:cv|c\.v\.|resume|résumé)|academic\s+cv|professional\s+(?:cv|resume|biography|bio)|full\s+cv)\b/i;

const CV_PATH =
  /(?:^|\/)(?:[^/?#]*[-_])?(?:cv|c\.v|resume|curriculum[-_]?vitae|vitae)(?:[-_.][^/?#]*)?(?:\.pdf)?(?:$|[?#])/i;

const BIO_PAGE =
  /\b(about|biography|bio|profile|curriculum|credentials|education|publications|cv|resume)\b/i;

const SKIP_HOST =
  /(?:^|\.)(?:facebook|instagram|twitter|x|linkedin|youtube|tiktok|pinterest)\.com$/i;

/**
 * Score whether an href + link text looks like the expert's CV document.
 * Higher is better; callers should keep only scores >= minScore.
 */
export function scoreCvLinkCandidate(input: {
  href: string;
  text: string;
  pageUrl: string;
  pageTitle?: string | null;
}): { score: number; reason: string } | null {
  let url: URL;
  try {
    url = new URL(input.href, input.pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (SKIP_HOST.test(host)) return null;

  const href = url.toString();
  const text = input.text.replace(/\s+/g, ' ').trim();
  const file = (url.pathname.split('/').pop() ?? '').toLowerCase();
  const path = url.pathname.toLowerCase();
  const pageHay = `${input.pageUrl} ${input.pageTitle ?? ''}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (CV_TEXT.test(text)) {
    score += 50;
    reasons.push('link-text');
  }
  if (CV_PATH.test(path) || CV_PATH.test(file)) {
    score += 40;
    reasons.push('path');
  }
  if (/\.pdf($|\?)/i.test(href) || /\.pdf$/i.test(file)) {
    score += 15;
    reasons.push('pdf');
  }
  if (isGoogleDriveFileUrl(href)) {
    score += 25;
    reasons.push('google-drive');
    if (CV_TEXT.test(text) || CV_TEXT.test(pageHay)) {
      score += 15;
      reasons.push('drive-cv-context');
    }
  }
  if (BIO_PAGE.test(pageHay) && (/\.pdf/i.test(href) || isGoogleDriveFileUrl(href))) {
    score += 10;
    reasons.push('bio-page-context');
  }
  // Generic PDF on an about/profile page with no other cue — weak candidate.
  if (
    score < 40 &&
    /\.pdf($|\?)/i.test(href) &&
    BIO_PAGE.test(pageHay) &&
    !/brochure|flyer|intake|consent|hipaa|map|form|invoice/i.test(
      `${file} ${text}`,
    )
  ) {
    score += 20;
    reasons.push('generic-pdf-on-profile');
  }

  if (score < 35) return null;
  return { score, reason: reasons.join(',') || 'scored' };
}

/**
 * Extract likely CV / resume document links from page HTML.
 * Dedupes by absolute URL and returns highest-scoring first.
 */
export function extractCvLinkCandidates(
  html: string,
  pageUrl: string,
  options: { pageTitle?: string | null; max?: number } = {},
): CvLinkCandidate[] {
  const max = options.max ?? 8;
  const byUrl = new Map<string, CvLinkCandidate>();
  const pattern =
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const hrefRaw = decodeHtmlEntities(match[1].trim());
    if (!hrefRaw || hrefRaw.startsWith('#') || /^(mailto|tel|javascript):/i.test(hrefRaw)) {
      continue;
    }
    const text = decodeHtmlEntities(
      match[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    // Also check title/aria-label on the opening tag.
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const labeled =
      openTag.match(/\b(?:title|aria-label)\s*=\s*["']([^"']+)["']/i)?.[1] ??
      '';
    const combinedText = `${text} ${decodeHtmlEntities(labeled)}`.trim();
    const scored = scoreCvLinkCandidate({
      href: hrefRaw,
      text: combinedText,
      pageUrl,
      pageTitle: options.pageTitle,
    });
    if (!scored) continue;
    let absolute: string;
    try {
      absolute = new URL(hrefRaw, pageUrl).toString();
    } catch {
      continue;
    }
    const prior = byUrl.get(absolute);
    if (!prior || scored.score > prior.score) {
      byUrl.set(absolute, {
        url: absolute,
        text: combinedText.slice(0, 160),
        score: scored.score,
        reason: scored.reason,
      });
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Keep only the strongest CV candidates across many pages. */
export function selectTopCvCandidates(
  candidates: CvLinkCandidate[],
  limit = 5,
): CvLinkCandidate[] {
  const byUrl = new Map<string, CvLinkCandidate>();
  for (const candidate of candidates) {
    const prior = byUrl.get(candidate.url);
    if (!prior || candidate.score > prior.score) {
      byUrl.set(candidate.url, candidate);
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
