import { SearchProviderError } from '../web-research.types';

const USER_AGENT = 'EWI-ResearchBot/1.0 (public-source research for attorneys)';

export interface SearchHttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Response parsing. Default json. */
  as?: 'json' | 'text';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * One request to a search API. Retries once on rate limits, 5xx and network
 * drops. Everything else is a typed SearchProviderError.
 */
export async function searchHttp<T>(
  url: string,
  options: SearchHttpOptions,
  attempt = 1,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept:
          options.as === 'text'
            ? 'application/xml, text/xml, */*'
            : 'application/json',
        'User-Agent': USER_AGENT,
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (attempt < 2) {
      await sleep(800);
      return searchHttp<T>(url, options, attempt + 1);
    }
    throw new SearchProviderError(
      timedOut
        ? 'The search request timed out.'
        : 'The search service could not be reached.',
      timedOut ? 'timeout' : 'network',
    );
  }

  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 6) * 1000
        : 1500,
    );
    return searchHttp<T>(url, options, attempt + 1);
  }
  if (response.status === 429) {
    throw new SearchProviderError(
      'The search service rate limited the request (HTTP 429).',
      'rate_limited',
      429,
    );
  }
  if (response.status === 402) {
    throw new SearchProviderError(
      'The search service reports no remaining credit (HTTP 402).',
      'quota',
      402,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new SearchProviderError(
      `The search service rejected the credentials (HTTP ${response.status}).`,
      'auth',
      response.status,
    );
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 400);
    } catch {
      detail = '';
    }
    if (response.status === 400) {
      const host = hostOf(url);
      const creditFailure =
        /not enough credit|insufficient credit|no remaining credit|quota|\bcredits?\b/i.test(
          detail,
        ) || /(^|\.)serper\.dev$/i.test(host);
      if (creditFailure) {
        throw new SearchProviderError(
          'The search service reports no remaining credit (HTTP 400).',
          'quota',
          400,
        );
      }
    }
    throw new SearchProviderError(
      `The search service returned HTTP ${response.status}.`,
      'http',
      response.status,
    );
  }
  try {
    return (
      options.as === 'text' ? await response.text() : await response.json()
    ) as T;
  } catch {
    throw new SearchProviderError(
      'The search service returned a response that could not be read.',
      'http',
      response.status,
    );
  }
}
