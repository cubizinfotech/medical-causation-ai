import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { LiveHttpError } from './live-http';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { displayName, parsePersonName } from './person-name';

const SEARCH_HOST = 'https://law.justia.com';
const MAX_LINKS = 8;

export interface JustiaHit {
  url: string;
  title: string;
}

/**
 * Pulls case links from a Justia results page. A link counts only when the
 * expert's last name appears in the link text or the text beside it.
 */
export function parseJustiaHits(html: string, lastName: string): JustiaHit[] {
  const last = lastName.trim().toLowerCase();
  if (last.length < 2) return [];
  const hits: JustiaHit[] = [];
  const seen = new Set<string>();
  const pattern =
    /<a\b[^>]*href="([^"]*\/cases\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null && hits.length < MAX_LINKS) {
    const href = match[1];
    const title = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title.toLowerCase().includes(last)) continue;
    const url = href.startsWith('http') ? href : `${SEARCH_HOST}${href}`;
    if (!url.startsWith(`${SEARCH_HOST}/`)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    hits.push({ url, title: title.slice(0, 240) || url });
  }
  return hits;
}

export function justiaPageIsReadable(html: string): boolean {
  if (html.length < 200) return false;
  const lower = html.toLowerCase();
  if (
    lower.includes('cf-browser-verification') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies')
  ) {
    return false;
  }
  return true;
}

/**
 * Public Justia search. Failure to read the page is an error, not an empty
 * finding. A readable page with no name match is a completed search.
 */
export class JustiaResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 20000,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const name = parsePersonName(query.expertName);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. Justia is searched by the expert’s full name, so a first and last name are needed.',
      };
    }
    const quoted = `"${displayName(name)}"`;
    const url = `${SEARCH_HOST}/search?q=${encodeURIComponent(quoted)}`;
    const html = await this.readPage(url);
    if (!justiaPageIsReadable(html)) {
      throw new LiveHttpError(
        'Justia did not return a readable results page. This is not a finding that no case exists.',
        'http',
      );
    }
    const hits = parseJustiaHits(html, name.last);
    if (hits.length === 0) {
      return {
        items: [],
        status: 'no_result',
        message: `Searched Justia for ${quoted}. No case link on the results page included the expert’s last name. That is not proof that no case exists.`,
      };
    }
    return {
      items: hits.map((hit) => this.caseItem(hit, quoted, retrievedAt)),
      message: `Justia results page listed ${hits.length} case link(s) for ${quoted}. Open each link before treating it as the same person.`,
    };
  }

  private async readPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent':
            'medical-causation-ai/1.0 (expert witness research; public records)',
        },
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        throw new LiveHttpError(
          'Justia redirected the search. The page was not followed. This is not a finding that no case exists.',
          'http',
          response.status,
        );
      }
      if (!response.ok) {
        throw new LiveHttpError(
          `Justia returned HTTP ${response.status}. This is not a finding that no case exists.`,
          response.status === 429 ? 'rate_limited' : 'http',
          response.status,
        );
      }
      return await response.text();
    } catch (error) {
      if (error instanceof LiveHttpError) throw error;
      throw new LiveHttpError(
        'Justia could not be reached. This is not a finding that no case exists.',
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private caseItem(
    hit: JustiaHit,
    quoted: string,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    return this.item({
      category: 'legal',
      title: hit.title,
      summary: `Public Justia case link returned for ${quoted}. Confirm the person before relying on it.`,
      url: hit.url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        documentType: 'case',
        caseName: hit.title,
        source: 'Justia',
        resultUrl: hit.url,
      },
    });
  }
}
