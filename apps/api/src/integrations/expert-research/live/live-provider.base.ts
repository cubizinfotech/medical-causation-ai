import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  IExpertResearchProvider,
  InformationStatus,
  ProviderDefinition,
  ResearchOutcome,
} from '../expert-research.types';
import { LiveHttpError } from './live-http';

export interface LiveRunResult {
  items: ExpertEvidenceItem[];
  /** Shown with the source status; says what was and was not found. */
  message: string;
  /** Overrides the computed outcome, e.g. conflicting for an ambiguous NPI. */
  outcome?: ResearchOutcome;
  /** "unavailable" when the source was deliberately not searched. */
  status?: ExpertResearchSourceResult['status'];
  identity?: ExpertIdentityResolution;
}

const OUTCOME_BY_KIND: Record<LiveHttpError['kind'], ResearchOutcome> = {
  timeout: 'timeout',
  rate_limited: 'rate_limited',
  auth: 'authentication_required',
  http: 'api_failure',
  network: 'api_failure',
};

/**
 * A source connected to its real public API. Failures become source
 * statuses; nothing is invented when a request fails.
 */
export abstract class LiveResearchProvider implements IExpertResearchProvider {
  constructor(readonly definition: ProviderDefinition) {}

  get id() {
    return this.definition.id;
  }

  protected abstract run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult>;

  async search(
    query: ExpertResearchQuery,
  ): Promise<ExpertResearchSourceResult> {
    const retrievedAt = new Date().toISOString();
    try {
      const run = await this.run(query, retrievedAt);
      const status = run.status ?? (run.items.length > 0 ? 'ok' : 'no_result');
      return {
        sourceId: this.definition.id,
        status,
        outcome:
          run.outcome ??
          (status === 'unavailable'
            ? 'unavailable'
            : run.items.length > 0
              ? 'success'
              : 'no_result'),
        access: 'public',
        message: run.message,
        retrievedAt,
        items: run.items,
        ...(run.identity ? { identity: run.identity } : {}),
      };
    } catch (error) {
      const kind = error instanceof LiveHttpError ? error.kind : 'http';
      const reason =
        error instanceof Error ? error.message : 'The request failed.';
      return {
        sourceId: this.definition.id,
        status: 'error',
        outcome: OUTCOME_BY_KIND[kind],
        access: 'public',
        message: `${this.definition.name}: ${reason} Nothing was inferred from this source.`,
        retrievedAt,
        items: [],
      };
    }
  }

  protected item(params: {
    category: string;
    title: string;
    summary: string;
    url?: string;
    retrievedAt: string;
    informationStatus: InformationStatus;
    raw: Record<string, unknown>;
  }): ExpertEvidenceItem {
    return {
      sourceId: this.definition.id,
      category: params.category,
      title: params.title,
      summary: params.summary,
      url: params.url,
      simulated: false,
      access: 'public',
      informationStatus: params.informationStatus,
      retrievedAt: params.retrievedAt,
      source: {
        providerId: this.definition.id,
        name: this.definition.name,
        url: params.url,
        retrievedAt: params.retrievedAt,
        access: 'public',
      },
      raw: params.raw,
    };
  }
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Runs work over items with at most `limit` requests in flight. */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}
