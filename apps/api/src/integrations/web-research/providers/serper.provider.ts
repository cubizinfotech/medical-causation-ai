import type {
  SearchHit,
  SearchProvider,
  SearchRequest,
  WebSearchKind,
} from '../web-research.types';
import { searchHttp } from './search-http';

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}
interface SerperPlace {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  cid?: string;
}
interface SerperResponse {
  organic?: SerperOrganic[];
  news?: Array<SerperOrganic & { source?: string }>;
  places?: SerperPlace[];
}

/** Google results through serper.dev. Enabled only when SERPER_API_KEY is set. */
export class SerperSearchProvider implements SearchProvider {
  readonly id = 'serper';
  readonly name = 'Serper (Google Search API)';
  readonly kinds: readonly WebSearchKind[] = [
    'web',
    'news',
    'places',
    'scholar',
  ];
  readonly budget = 45;
  readonly concurrency = 4;

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
    const endpoint =
      request.kind === 'news'
        ? 'news'
        : request.kind === 'places'
          ? 'places'
          : request.kind === 'scholar'
            ? 'scholar'
            : 'search';
    const payload = await searchHttp<SerperResponse>(
      `https://google.serper.dev/${endpoint}`,
      {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey ?? '' },
        body: {
          q: request.query,
          gl: 'us',
          hl: 'en',
          num: request.num ?? 10,
          ...(request.page && request.page > 1 ? { page: request.page } : {}),
        },
        timeoutMs,
        fetchImpl: this.fetchImpl,
      },
    );
    const hits: SearchHit[] = [];
    for (const item of payload.organic ?? payload.news ?? []) {
      if (!item.link) continue;
      hits.push({
        url: item.link,
        title: item.title ?? item.link,
        snippet: item.snippet,
        publishedAt: item.date,
        providerId: this.id,
        query: request.query,
        kind: request.kind,
      });
    }
    for (const place of payload.places ?? []) {
      const url =
        place.website ??
        (place.cid
          ? `https://www.google.com/maps?cid=${place.cid}`
          : undefined);
      if (!url) continue;
      hits.push({
        url,
        title: place.title ?? url,
        snippet: place.address,
        providerId: this.id,
        query: request.query,
        kind: 'places',
        place: {
          address: place.address,
          phone: place.phoneNumber,
          website: place.website,
          rating: place.rating,
          ratingCount: place.ratingCount,
        },
      });
    }
    return hits;
  }
}
