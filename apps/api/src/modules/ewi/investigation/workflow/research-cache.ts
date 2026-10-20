import type {
  ExpertResearchQuery,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { WEB_RESEARCH_SOURCE_IDS } from '@integrations/web-research/source-kind';

export interface ResearchCacheEntry {
  result: ExpertResearchSourceResult;
  storedAt: number;
}

/**
 * In-process cache for safe public research results within the API process.
 * Restricted or failed results are never cached. Used to avoid repeating the
 * same public lookup during retries or overlapping investigations.
 */
export class PublicResearchCache {
  private readonly entries = new Map<string, ResearchCacheEntry>();

  constructor(private readonly ttlMs: number) {}

  static key(query: ExpertResearchQuery, providerId: string): string {
    return [
      providerId,
      normalize(query.expertName),
      normalize(query.city),
      normalize(query.specialty),
      query.npi?.trim() ?? '',
      normalize(query.context ?? ''),
    ].join('|');
  }

  get(
    query: ExpertResearchQuery,
    providerId: string,
  ): ExpertResearchSourceResult | null {
    if (this.ttlMs <= 0) return null;
    const key = PublicResearchCache.key(query, providerId);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return {
      ...entry.result,
      items: entry.result.items.map((item) => ({ ...item })),
      message: `${entry.result.message ?? 'Cached public result.'} (cached)`,
    };
  }

  set(query: ExpertResearchQuery, result: ExpertResearchSourceResult): void {
    if (this.ttlMs <= 0) return;
    if (!isCacheable(result)) return;
    this.entries.set(PublicResearchCache.key(query, result.sourceId), {
      result: {
        ...result,
        items: result.items.map((item) => ({ ...item })),
      },
      storedAt: Date.now(),
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

const WEB_SOURCES = new Set<string>(WEB_RESEARCH_SOURCE_IDS);

function isCacheable(result: ExpertResearchSourceResult): boolean {
  // The web engine keeps its own short-lived run; a cut-short or partly failed
  // search must not be replayed as a finished "no result".
  if (WEB_SOURCES.has(result.sourceId)) return false;
  if (result.access === 'restricted') return false;
  if (result.status === 'error') return false;
  if (result.outcome === 'restricted') return false;
  if (result.outcome === 'authentication_required') return false;
  if (result.outcome === 'rate_limited') return false;
  if (result.outcome === 'timeout') return false;
  if (result.outcome === 'api_failure') return false;
  return result.status === 'ok' || result.status === 'no_result';
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
