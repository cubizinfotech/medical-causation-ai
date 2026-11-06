import { normalizeFindingUrl } from './evidence-gate';
import type { RoutedFinding } from './section-router';

/** One expert-owned (or other) website with relevant subpages for §20. */
export interface WebsiteHostGroup {
  host: string;
  /** Preferred primary page URL (original, not re-written). */
  primaryUrl: string;
  primaryTitle: string;
  ownershipLabel: string;
  summary: string;
  retrievedAt: string | null;
  subpages: Array<{
    url: string;
    path: string;
    title: string;
    description: string;
    retrievedAt: string | null;
  }>;
  selfReportedNotes: string[];
}

const RELEVANT_PAGE =
  /\b(about|bio|biography|curriculum|vitae|\bcv\b|credential|education|experience|forensic|expert\s+witness|evaluat|therap|clinical|service|specialty|specialt|publication|member|contact|location|office|practice|billing|community)\b/i;

const IRRELEVANT_ONLY =
  /\b(privacy|cookie|terms of (use|service)|accessibility|sitemap|login|sign[\s-]?in)\b/i;

/** File hosts / CV download mirrors are not expert practice websites. */
const NON_WEBSITE_HOSTS =
  /(^|\.)(drive\.google\.com|drive\.usercontent\.google\.com|docs\.google\.com|dropbox\.com|box\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|amazonaws\.com|cloudfront\.net|blob\.core\.windows\.net)$/i;

export function isNonWebsiteDocumentHost(hostOrUrl: string): boolean {
  const host = hostOrUrl.includes('://') ? hostOf(hostOrUrl) : hostOrUrl;
  return NON_WEBSITE_HOSTS.test(host);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return '/';
  }
}

export function pageLooksRelevant(
  title: string,
  description: string,
  path: string,
): boolean {
  const hay = `${title} ${description} ${path}`;
  if (path === '/' || path === '') return true;
  if (RELEVANT_PAGE.test(hay)) return true;
  if (IRRELEVANT_ONLY.test(hay) && !RELEVANT_PAGE.test(hay)) return false;
  // Keep pages with substantive text even without keyword hits.
  return description.replace(/\s+/g, ' ').trim().length >= 40;
}

export interface WebsiteGroupInput {
  url: string;
  title: string;
  summary: string;
  retrievedAt?: string | null;
  /** Own practice site / subject_stated → owned. */
  owned?: boolean;
  selfReportedNote?: string | null;
}

/**
 * Group website pages by www-stripped host for Expert Websites rendering.
 * Preserves original URLs; filters thin/irrelevant subpages.
 */
export function groupWebsitesByHost(
  pages: WebsiteGroupInput[],
  options: { maxSubpages?: number } = {},
): WebsiteHostGroup[] {
  const maxSubpages = options.maxSubpages ?? 8;
  const byHost = new Map<string, WebsiteGroupInput[]>();
  const seenUrl = new Set<string>();
  for (const page of pages) {
    const key = normalizeFindingUrl(page.url);
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    const host = hostOf(page.url);
    if (isNonWebsiteDocumentHost(host)) continue;
    const bucket = byHost.get(host) ?? [];
    bucket.push(page);
    byHost.set(host, bucket);
  }

  const groups: WebsiteHostGroup[] = [];
  for (const [host, list] of byHost) {
    const owned = list.some((p) => p.owned);
    list.sort((a, b) => {
      const ap = pathOf(a.url);
      const bp = pathOf(b.url);
      if (ap === '/' && bp !== '/') return -1;
      if (bp === '/' && ap !== '/') return 1;
      return ap.length - bp.length;
    });
    const primary = list[0];
    const selfReportedNotes = [
      ...new Set(
        list
          .map((p) => p.selfReportedNote?.trim())
          .filter((n): n is string => Boolean(n)),
      ),
    ].slice(0, 4);

    const subpages = list
      .filter((p) => normalizeFindingUrl(p.url) !== normalizeFindingUrl(primary.url))
      .filter((p) =>
        pageLooksRelevant(p.title, p.summary, pathOf(p.url)),
      )
      .slice(0, maxSubpages)
      .map((p) => ({
        url: p.url,
        path: pathOf(p.url),
        title: p.title.replace(/\s+/g, ' ').trim().slice(0, 120) || pathOf(p.url),
        description: p.summary.replace(/\s+/g, ' ').trim().slice(0, 200),
        retrievedAt: p.retrievedAt ?? null,
      }));

    groups.push({
      host,
      primaryUrl: primary.url,
      primaryTitle:
        primary.title.replace(/\s+/g, ' ').trim().slice(0, 120) || host,
      ownershipLabel: owned
        ? 'Expert’s own professional website (self-reported)'
        : 'Mentions the expert; ownership not established as the expert’s site',
      summary: primary.summary.replace(/\s+/g, ' ').trim().slice(0, 280),
      retrievedAt: primary.retrievedAt ?? null,
      subpages,
      selfReportedNotes,
    });
  }

  return groups.sort((a, b) => a.host.localeCompare(b.host));
}

/** Convert routed website findings into grouping inputs. */
export function websiteInputsFromRoutedFindings(
  findings: RoutedFinding[],
): WebsiteGroupInput[] {
  return findings.map((f) => ({
    url: f.url,
    title: f.title || f.sourceTitle,
    summary: f.statement,
    retrievedAt: f.retrievedAt,
    owned:
      f.basis === 'subject_stated' ||
      f.kind === 'expert_website' ||
      f.kind === 'profile' ||
      f.kind === 'advertising' ||
      f.kind === 'ime',
    selfReportedNote: /own statement|own publication|self-reported/i.test(
      `${f.title} ${f.statement}`,
    )
      ? f.statement.slice(0, 160)
      : null,
  }));
}
