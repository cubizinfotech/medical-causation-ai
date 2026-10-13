import { RateLimitExceededException } from '../exceptions';

const DEFAULT_WAIT_MS = 2000;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RateLimitRetryOptions {
  /** Longest wait between tries, whatever the provider asks for. */
  maxWaitMs?: number;
  /** Total tries, the first one included. */
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * For AI calls inside background jobs (nobody waits on an HTTP response):
 * honour the provider's wait up to a minute and try up to three times, so a
 * busy free-tier provider does not drop part of an analysis.
 */
export const BACKGROUND_RATE_LIMIT_RETRY: RateLimitRetryOptions = {
  maxWaitMs: 60_000,
  attempts: 3,
};

/**
 * Runs an AI call; after a rate-limit error, waits the time the provider
 * asked for (at most maxWaitMs) and tries again, up to `attempts` tries in
 * total (default 2). Other errors, and the last rate-limit error, are thrown
 * to the caller.
 */
export async function retryOnRateLimit<T>(
  call: () => Promise<T>,
  options: RateLimitRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof RateLimitExceededException)) throw error;
      if (attempt >= attempts) throw error;
      const wait = Math.min(
        error.retryAfterMs ?? DEFAULT_WAIT_MS,
        options.maxWaitMs ?? 10_000,
      );
      await (options.sleep ?? pause)(wait);
    }
  }
}
