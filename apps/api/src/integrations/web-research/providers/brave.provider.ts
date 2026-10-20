import type {
  SearchHit,
  SearchProvider,
  SearchRequest,
  WebSearchKind,
} from '../web-research.types';
import { searchHttp } from './search-http';

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
  age?: string;
}
interface BraveResponse {
  web?: { results?: BraveResult[] };
  results?: BraveResult[];
}

/** Brave Search API. Enabled only when BRAVE_SEARCH_API_KEY is set. */
export class BraveSearchProvider implements SearchProvider {
  readonly id = 'brave';
  readonly name = 'Brave Search API';
  readonly kinds: readonly WebSearchKind[] = ['web', 'news'];
  readonly budget = 35;
  readonly concurrency = 1;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(
    request: SearchRequest,
    timeoutMs: number,
  ): Promise<SearchHit[]> {
    const path = request.kind === 'news' ? 'news/search' : 'web/search';
    const url = new URL(`https://api.search.brave.com/res/v1/${path}`);
    url.searchParams.set('q', request.query);
    url.searchParams.set('count', String(Math.min(request.num ?? 10, 20)));
    if (request.page && request.page > 1) {
      url.searchParams.set('offset', String(request.page - 1));
    }
    const payload = await searchHttp<BraveResponse>(url.toString(), {
      headers: { 'X-Subscription-Token': this.apiKey ?? '' },
      timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    const results = payload.web?.results ?? payload.results ?? [];
    return results
      .filter((item) => item.url)
      .map((item) => ({
        url: item.url as string,
        title: item.title ?? (item.url as string),
        snippet: item.description?.replace(/<[^>]+>/g, ''),
        publishedAt: item.page_age ?? item.age,
        providerId: this.id,
        query: request.query,
        kind: request.kind,
      }));
  }
}
