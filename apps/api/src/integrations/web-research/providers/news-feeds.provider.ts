import {
  SearchProviderError,
  type SearchHit,
  type SearchProvider,
  type SearchRequest,
  type WebSearchKind,
} from '../web-research.types';
import { searchHttp } from './search-http';

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const match = block.match(
    new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'),
  );
  return match ? decodeEntities(match[1]) : undefined;
}

/**
 * Google News article ids are base64url protobuf that often embed the
 * publisher URL. Returns it when present; otherwise the Google link stays.
 */
export function decodeGoogleNewsUrl(link: string): string {
  try {
    const url = new URL(link);
    if (url.hostname !== 'news.google.com') return link;
    const id = url.pathname.split('/').pop() ?? '';
    const padded = id.replace(/-/g, '+').replace(/_/g, '/');
    const text = Buffer.from(padded, 'base64').toString('latin1');
    const match = text.match(/https?:\/\/[\x21-\x7e]+/);
    if (match) {
      const found = match[0].replace(/[^\x21-\x7e]+$/, '');
      const host = new URL(found).hostname;
      if (!host.endsWith('google.com')) return found;
    }
  } catch {
    // keep the Google link
  }
  return link;
}

/** Google News RSS search. No key. Publisher, headline and date only. */
export class GoogleNewsRssProvider implements SearchProvider {
  readonly id = 'google_news_rss';
  readonly name = 'Google News (RSS)';
  readonly kinds: readonly WebSearchKind[] = ['news'];
  readonly budget = 4;
  readonly concurrency = 1;

  constructor(private readonly fetchImpl?: typeof fetch) {}

  isConfigured(): boolean {
    return true;
  }

  async search(
    request: SearchRequest,
    timeoutMs: number,
  ): Promise<SearchHit[]> {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', request.query);
    url.searchParams.set('hl', 'en-US');
    url.searchParams.set('gl', 'US');
    url.searchParams.set('ceid', 'US:en');
    const xml = await searchHttp<string>(url.toString(), {
      as: 'text',
      timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    const hits: SearchHit[] = [];
    for (const block of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
      const link = tag(block, 'link');
      if (!link) continue;
      const source = tag(block, 'source');
      const title = tag(block, 'title') ?? link;
      hits.push({
        url: decodeGoogleNewsUrl(link),
        title:
          source && title.endsWith(` - ${source}`)
            ? title.slice(0, -(source.length + 3))
            : title,
        snippet: source ? `Published by ${source}.` : undefined,
        publishedAt: tag(block, 'pubDate'),
        providerId: this.id,
        query: request.query,
        kind: 'news',
      });
    }
    return hits.slice(0, request.num ?? 30);
  }
}

let lastGdeltCall = 0;

/** GDELT DOC API: news articles worldwide, no key, one request per 5 seconds. */
export class GdeltNewsProvider implements SearchProvider {
  readonly id = 'gdelt';
  readonly name = 'GDELT news index';
  readonly kinds: readonly WebSearchKind[] = ['news'];
  readonly budget = 3;
  readonly concurrency = 1;

  constructor(private readonly fetchImpl?: typeof fetch) {}

  isConfigured(): boolean {
    return true;
  }

  async search(
    request: SearchRequest,
    timeoutMs: number,
  ): Promise<SearchHit[]> {
    const wait = lastGdeltCall + 5500 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGdeltCall = Date.now();
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', request.query);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('maxrecords', String(request.num ?? 50));
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'datedesc');
    const text = await searchHttp<string>(url.toString(), {
      as: 'text',
      timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    let payload: {
      articles?: Array<{
        url?: string;
        title?: string;
        seendate?: string;
        domain?: string;
      }>;
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new SearchProviderError(
        `GDELT did not return results: ${text.slice(0, 120).trim()}`,
        'rate_limited',
      );
    }
    return (payload.articles ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        url: item.url as string,
        title: item.title ?? (item.url as string),
        snippet: item.domain ? `Published by ${item.domain}.` : undefined,
        publishedAt: gdeltDate(item.seendate),
        providerId: this.id,
        query: request.query,
        kind: 'news' as const,
      }));
  }
}

function gdeltDate(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}
