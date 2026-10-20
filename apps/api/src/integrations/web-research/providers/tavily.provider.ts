import type {
  SearchHit,
  SearchProvider,
  SearchRequest,
  WebSearchKind,
} from '../web-research.types';
import { searchHttp } from './search-http';

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }>;
}

/** Tavily search API. Enabled only when TAVILY_API_KEY is set. */
export class TavilySearchProvider implements SearchProvider {
  readonly id = 'tavily';
  readonly name = 'Tavily Search API';
  readonly kinds: readonly WebSearchKind[] = ['web', 'news'];
  readonly budget = 25;
  readonly concurrency = 2;

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
    const payload = await searchHttp<TavilyResponse>(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey ?? ''}` },
        body: {
          query: request.query,
          max_results: Math.min(request.num ?? 10, 20),
          search_depth: 'basic',
          topic: request.kind === 'news' ? 'news' : 'general',
        },
        timeoutMs,
        fetchImpl: this.fetchImpl,
      },
    );
    return (payload.results ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        url: item.url as string,
        title: item.title ?? (item.url as string),
        snippet: item.content,
        publishedAt: item.published_date,
        providerId: this.id,
        query: request.query,
        kind: request.kind,
      }));
  }
}
