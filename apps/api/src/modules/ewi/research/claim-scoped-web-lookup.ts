/**
 * Claim-scoped SERP + SafeFetcher helpers for accreditation, membership,
 * directory, board-certification, and affiliation assessments.
 * Homepage reachability alone is never treated as a completed search.
 */
import type { WebResearchConfig } from '@config/config.types';
import { SafeFetcher } from '@integrations/web-research/safe-fetcher';
import { SerperSearchProvider } from '@integrations/web-research/providers/serper.provider';
import { BraveSearchProvider } from '@integrations/web-research/providers/brave.provider';
import type { SearchProvider } from '@integrations/web-research/web-research.types';

export interface ClaimScopedSearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface ClaimScopedFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
  restricted?: boolean;
  loginRequired?: boolean;
}

export interface ClaimScopedWebLookup {
  /** True when at least one SERP provider is configured. */
  isConfigured: boolean;
  search: (query: string) => Promise<ClaimScopedSearchHit[]>;
  fetchPage: (url: string) => Promise<ClaimScopedFetchResult | null>;
}

function pickProviders(web: WebResearchConfig | undefined): SearchProvider[] {
  if (!web) return [];
  const wanted = new Set(
    (web.providers ?? []).map((id) => id.toLowerCase()).filter(Boolean),
  );
  const out: SearchProvider[] = [];
  const serper = new SerperSearchProvider(web.serperApiKey);
  const brave = new BraveSearchProvider(web.braveApiKey);
  if (
    serper.isConfigured() &&
    (wanted.size === 0 || wanted.has('serper'))
  ) {
    out.push(serper);
  }
  if (brave.isConfigured() && (wanted.size === 0 || wanted.has('brave'))) {
    out.push(brave);
  }
  return out;
}

/**
 * Builds claim-scoped search/fetch callbacks from research.web settings.
 * Returns null when no SERP provider is configured so assessors keep
 * Not Checked / Self-Reported instead of inventing empty search outcomes.
 */
export function createClaimScopedWebLookup(
  web: WebResearchConfig | undefined,
  options: { timeoutMs?: number } = {},
): ClaimScopedWebLookup | null {
  const providers = pickProviders(web);
  if (providers.length === 0) return null;

  const searchTimeoutMs = web?.searchTimeoutMs ?? options.timeoutMs ?? 15_000;
  const fetchTimeoutMs = web?.fetchTimeoutMs ?? options.timeoutMs ?? 20_000;
  const fetcher = new SafeFetcher({ timeoutMs: fetchTimeoutMs });

  return {
    isConfigured: true,
    search: async (query: string): Promise<ClaimScopedSearchHit[]> => {
      const trimmed = query.replace(/\s+/g, ' ').trim();
      if (!trimmed) return [];
      const hits: ClaimScopedSearchHit[] = [];
      const seen = new Set<string>();
      for (const provider of providers) {
        try {
          const batch = await provider.search(
            { query: trimmed, kind: 'web', num: 10 },
            searchTimeoutMs,
          );
          for (const hit of batch) {
            const key = hit.url.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            hits.push({
              url: hit.url,
              title: hit.title ?? null,
              snippet: hit.snippet ?? null,
            });
          }
        } catch {
          // Try the next provider; assessors treat total failure as unable_to_access.
        }
      }
      return hits;
    },
    fetchPage: async (url: string): Promise<ClaimScopedFetchResult | null> => {
      try {
        const page = await fetcher.fetchPage(url);
        const retrievedAt = new Date().toISOString();
        if (page.status === 'restricted') {
          return {
            url,
            title: page.title ?? null,
            text: page.text ?? page.note ?? '',
            retrievedAt,
            restricted: true,
            loginRequired: /login|sign in|captcha|subscribe/i.test(
              page.note ?? '',
            ),
          };
        }
        if (page.status !== 'read' || !page.text) return null;
        return {
          url,
          title: page.title ?? null,
          text: page.text,
          retrievedAt,
        };
      } catch {
        return null;
      }
    },
  };
}
