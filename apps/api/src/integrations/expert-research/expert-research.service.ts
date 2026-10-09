import { Injectable } from '@nestjs/common';
import type { ResearchProviderSettings } from '@config/config.types';
import type {
  ExpertResearchProviderId,
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  IExpertResearchProvider,
  ProviderDefinition,
} from './expert-research.types';
import { CatalogExpertResearchProvider } from './providers/catalog-expert-research.provider';
import { EXPERT_RESEARCH_CATALOG } from './providers/provider-catalog';
import { createLiveSourceProviders } from './live/live-sources';
import { OpenAlexClient } from './live/openalex.client';
import {
  PublicationTitleLookup,
  type PublicationLookupResult,
} from './live/publication-lookup';
import { applyIdentityMatch } from './providers/identity-match';
import { applyPublicEvidenceGate } from './providers/public-affiliation';
import { markConflicts } from './providers/information-status';
import { researchOutcomeFor } from './providers/research-outcome';
import {
  ProviderRateLimiter,
  validateExpertResearchQuery,
  type ProviderRuntimeOptions,
} from './providers/provider-runtime';

export function createExpertResearchRuntime(
  settings?: ResearchProviderSettings,
): ProviderRuntimeOptions {
  const timeoutMs = settings?.timeoutMs ?? 20000;
  return {
    mode: settings?.mode === 'live' ? 'live' : 'mock',
    timeoutMs,
    minIntervalMs: settings?.minIntervalMs ?? 0,
    live: {
      timeoutMs,
      courtListenerToken: settings?.courtListenerToken,
      courtListenerTimeoutMs: settings?.courtListenerTimeoutMs,
      openAlexApiKey: settings?.openAlexApiKey,
      openAlexMailto: settings?.openAlexMailto,
      openPaymentsYears: settings?.openPaymentsYears,
    },
  };
}

/**
 * One provider per catalog entry. In live mode the connected public sources
 * use their real adapters; every other source keeps the catalog behavior.
 */
export function createCatalogProviders(
  runtime: ProviderRuntimeOptions,
  rateLimiter: ProviderRateLimiter = new ProviderRateLimiter(),
): IExpertResearchProvider[] {
  const live =
    runtime.mode === 'live'
      ? createLiveSourceProviders(
          EXPERT_RESEARCH_CATALOG,
          runtime.live ?? { timeoutMs: runtime.timeoutMs },
        )
      : new Map<ExpertResearchProviderId, IExpertResearchProvider>();
  return EXPERT_RESEARCH_CATALOG.map(
    (definition) =>
      live.get(definition.id) ??
      new CatalogExpertResearchProvider(definition, runtime, rateLimiter),
  );
}

/** OpenAlex title checks for CV publications; null outside live mode. */
export function createPublicationLookup(
  runtime: ProviderRuntimeOptions,
): PublicationTitleLookup | null {
  if (runtime.mode !== 'live') return null;
  const live = runtime.live ?? { timeoutMs: runtime.timeoutMs };
  return new PublicationTitleLookup(
    new OpenAlexClient({
      timeoutMs: live.timeoutMs,
      fetchImpl: live.fetchImpl,
      apiKey: live.openAlexApiKey,
      mailto: live.openAlexMailto,
    }),
  );
}

@Injectable()
export class ExpertResearchService {
  constructor(
    private readonly providers: IExpertResearchProvider[],
    private readonly publicationLookup: PublicationTitleLookup | null = null,
  ) {}

  /**
   * Checks publication titles (from an uploaded CV) against OpenAlex.
   * Outside live mode every title comes back unavailable; nothing is guessed.
   */
  async lookupPublications(
    expertName: string,
    titles: string[],
  ): Promise<PublicationLookupResult[]> {
    if (!this.publicationLookup) {
      return titles.map((title) => ({ title, status: 'unavailable' as const }));
    }
    return this.publicationLookup.lookup(expertName, titles);
  }

  listProviders(): ProviderDefinition[] {
    return this.providers.map((provider) => provider.definition);
  }

  /**
   * Collects normalized results from every provider.
   * A provider error does not invent items and does not fail the other providers.
   */
  async collect(
    query: ExpertResearchQuery,
  ): Promise<ExpertResearchSourceResult[]> {
    return this.collectProviders(
      query,
      this.providers.map((provider) => provider.id),
    );
  }

  /**
   * Runs the requested providers. A missing provider returns unavailable
   * and does not invent a record.
   */
  async collectProviders(
    query: ExpertResearchQuery,
    providerIds: readonly ExpertResearchProviderId[],
  ): Promise<ExpertResearchSourceResult[]> {
    const validated = validateExpertResearchQuery(query);
    const retrievedAt = new Date().toISOString();
    if (!validated.ok) {
      return providerIds.map((sourceId) => ({
        sourceId,
        status: 'error' as const,
        outcome: 'api_failure' as const,
        access: 'unavailable' as const,
        message: validated.message,
        retrievedAt,
        items: [],
      }));
    }

    const selected = new Map(
      this.providers.map((provider) => [provider.id, provider]),
    );
    const results = await Promise.all(
      providerIds.map(async (providerId) => {
        const provider = selected.get(providerId);
        if (!provider) {
          return {
            sourceId: providerId,
            status: 'unavailable' as const,
            outcome: 'unavailable' as const,
            access: 'unavailable' as const,
            message:
              'No adapter is registered for this source. Nothing was inferred.',
            retrievedAt,
            items: [],
          };
        }
        try {
          return await provider.search(validated.value);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Provider failed';
          return {
            sourceId: provider.id,
            status: 'error' as const,
            outcome: researchOutcomeFor({
              status: 'error',
              access: provider.definition.accessClass,
              message,
              itemCount: 0,
            }),
            access: provider.definition.accessClass,
            message,
            retrievedAt: new Date().toISOString(),
            items: [],
          };
        }
      }),
    );

    const identified = results.map((result) =>
      applyPublicEvidenceGate(validated.value, {
        ...result,
        items: applyIdentityMatch(validated.value, result.items),
      }),
    );
    const marked = markConflicts(identified.flatMap((result) => result.items));
    let offset = 0;
    return identified.map((result) => {
      const items = marked.slice(offset, offset + result.items.length);
      offset += result.items.length;
      const conflicting = items.some(
        (item) => item.informationStatus === 'conflicting',
      );
      return {
        ...result,
        items,
        outcome:
          result.outcome === 'success' && conflicting
            ? 'conflicting'
            : result.outcome,
      };
    });
  }
}
