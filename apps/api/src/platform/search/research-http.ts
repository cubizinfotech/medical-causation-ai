export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'UpstreamHttpError';
  }
}

export interface ResearchHttpOptions {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared HTTP helper for research/search adapters.
 * Applies timeout, retry, and Retry-After aware backoff. Does not log request headers.
 */
export async function fetchResearch(
  url: string,
  init: RequestInit,
  options: ResearchHttpOptions,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 0);
        const delay =
          retryAfter > 0 ? retryAfter * 1000 : options.retryDelayMs * attempt;
        lastError = new UpstreamHttpError(
          `Research request failed (${response.status})`,
          response.status,
          delay,
        );
        if (attempt < options.maxRetries) {
          await sleep(delay);
          continue;
        }
        throw lastError;
      }
      if (!response.ok) {
        throw new UpstreamHttpError(
          `Research request failed (${response.status})`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (
        error instanceof UpstreamHttpError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }
      lastError =
        error instanceof Error ? error : new Error('Research request failed');
      if (attempt >= options.maxRetries) {
        throw lastError;
      }
      await sleep(options.retryDelayMs * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Research request failed');
}
