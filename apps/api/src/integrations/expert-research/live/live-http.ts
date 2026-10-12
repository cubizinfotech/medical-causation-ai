export type LiveHttpErrorKind =
  'timeout' | 'rate_limited' | 'auth' | 'http' | 'network';

export class LiveHttpError extends Error {
  constructor(
    message: string,
    readonly kind: LiveHttpErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LiveHttpError';
  }
}

export interface LiveHttpOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
}

const USER_AGENT =
  'medical-causation-ai/1.0 (expert witness research; public records)';

/** Redirects followed per request, all on the requested host. */
const MAX_REDIRECTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class OffHostRedirectError extends Error {}

/**
 * fetch that follows redirects only on the host it was asked for. The
 * clients call fixed public APIs; a redirect elsewhere (another site or an
 * internal address) is refused rather than followed.
 */
async function fetchSameHost(
  fetchImpl: typeof fetch,
  url: URL | string,
  init: RequestInit,
): Promise<Response> {
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    const response = await fetchImpl(current, { ...init, redirect: 'manual' });
    const location = response.headers?.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    const next = new URL(location, current);
    if (
      hop >= MAX_REDIRECTS ||
      next.hostname !== current.hostname ||
      next.protocol !== 'https:'
    ) {
      throw new OffHostRedirectError();
    }
    current = next;
  }
}

/**
 * JSON request to a public research API. Retries once on rate limits, server
 * errors, and network drops; everything else surfaces as a typed error.
 */
export async function fetchJson<T>(
  url: URL | string,
  options: LiveHttpOptions,
  attempt = 1,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchSameHost(fetchImpl, url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
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
    if (error instanceof OffHostRedirectError) {
      throw new LiveHttpError(
        'The source redirected to another site; the request was not followed.',
        'http',
      );
    }
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (attempt < 2) {
      await sleep(1000);
      return fetchJson<T>(url, options, attempt + 1);
    }
    throw new LiveHttpError(
      timedOut
        ? 'The source timed out.'
        : 'The source could not be reached. It may be temporarily unavailable.',
      timedOut ? 'timeout' : 'network',
    );
  }

  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 5) * 1000
        : 1500,
    );
    return fetchJson<T>(url, options, attempt + 1);
  }
  if (response.status === 429) {
    throw new LiveHttpError(
      'The source rate limited the request (HTTP 429).',
      'rate_limited',
      429,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new LiveHttpError(
      'The source requires authentication.',
      'auth',
      response.status,
    );
  }
  if (!response.ok) {
    throw new LiveHttpError(
      `The source returned HTTP ${response.status}.`,
      'http',
      response.status,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new LiveHttpError(
      'The source returned a response that could not be read.',
      'http',
      response.status,
    );
  }
}
