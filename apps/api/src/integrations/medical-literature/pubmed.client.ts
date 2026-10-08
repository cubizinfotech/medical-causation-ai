import type { LiteratureSearchSettings } from '@config/config.types';
import type { PubMedSummary } from './medical-literature.types';

type FetchLike = typeof fetch;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * NCBI E-utilities client for PubMed.
 * Requests are serialized and spaced to stay under NCBI's limits:
 * 3 requests/second without an API key, 10 with one.
 */
export class PubMedClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  private readonly minIntervalMs: number;

  constructor(
    private readonly settings: LiteratureSearchSettings,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.minIntervalMs = settings.pubmedApiKey ? 110 : 350;
  }

  /** PubMed "Best Match" relevance ranking. */
  async search(
    query: string,
    limit: number,
  ): Promise<{ count: number; ids: string[] }> {
    const payload = (await this.request('esearch.fcgi', {
      term: query,
      sort: 'relevance',
      retmax: String(limit),
    })) as {
      esearchresult?: { count?: string; idlist?: string[]; ERROR?: string };
    };
    const result = payload.esearchresult;
    if (!result || result.ERROR) {
      throw new Error(`PubMed search failed: ${result?.ERROR ?? 'no result'}`);
    }
    return { count: Number(result.count ?? 0), ids: result.idlist ?? [] };
  }

  async summaries(ids: string[]): Promise<Map<string, PubMedSummary>> {
    const summaries = new Map<string, PubMedSummary>();
    if (ids.length === 0) return summaries;

    const payload = (await this.request('esummary.fcgi', {
      id: ids.join(','),
    })) as {
      result?: { uids?: string[] } & Record<string, unknown>;
    };
    for (const uid of payload.result?.uids ?? []) {
      const record = payload.result?.[uid] as PubMedSummary | undefined;
      if (record?.title) summaries.set(uid, record);
    }
    return summaries;
  }

  private request(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const run = this.queue.then(() => this.send(endpoint, params));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async send(
    endpoint: string,
    params: Record<string, string>,
    attempt = 1,
  ): Promise<unknown> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();

    const url = new URL(
      `${this.settings.pubmedBaseUrl.replace(/\/$/, '')}/${endpoint}`,
    );
    const query = {
      db: 'pubmed',
      retmode: 'json',
      tool: this.settings.tool,
      ...(this.settings.email ? { email: this.settings.email } : {}),
      ...(this.settings.pubmedApiKey
        ? { api_key: this.settings.pubmedApiKey }
        : {}),
      ...params,
    };
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.settings.timeoutMs),
      });
    } catch (error) {
      // Network drops and timeouts are usually brief; retry once.
      if (attempt < 2) {
        await sleep(1000);
        return this.send(endpoint, params, attempt + 1);
      }
      throw error;
    }

    // NCBI answers 429 when the rate limit is exceeded; retry once.
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await sleep(1000);
      return this.send(endpoint, params, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`PubMed ${endpoint} returned HTTP ${response.status}`);
    }
    return response.json();
  }
}
