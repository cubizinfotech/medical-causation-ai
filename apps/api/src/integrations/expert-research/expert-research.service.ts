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
import { markConflicts } from './providers/information-status';
import {
  ProviderRateLimiter,
  validateExpertResearchQuery,
  type ProviderRuntimeOptions,
} from './providers/provider-runtime';

export function createExpertResearchRuntime(
  settings?: ResearchProviderSettings,
): ProviderRuntimeOptions {
  return {
    mode: settings?.mode === 'live' ? 'live' : 'mock',
    timeoutMs: settings?.timeoutMs ?? 20000,
    minIntervalMs: settings?.minIntervalMs ?? 0,
  };
}

export function createCatalogProviders(
  runtime: ProviderRuntimeOptions,
  rateLimiter: ProviderRateLimiter = new ProviderRateLimiter(),
): IExpertResearchProvider[] {
  return EXPERT_RESEARCH_CATALOG.map(
    (definition) =>
      new CatalogExpertResearchProvider(definition, runtime, rateLimiter),
  );
}

@Injectable()
export class ExpertResearchService {
  constructor(private readonly providers: IExpertResearchProvider[]) {}

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
            access: provider.definition.accessClass,
            message,
            retrievedAt: new Date().toISOString(),
            items: [],
          };
        }
      }),
    );

    const marked = markConflicts(results.flatMap((result) => result.items));
    let offset = 0;
    return results.map((result) => {
      const items = marked.slice(offset, offset + result.items.length);
      offset += result.items.length;
      return { ...result, items };
    });
  }
}
