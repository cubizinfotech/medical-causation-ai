import { RateLimitExceededException } from '../exceptions';

const DEFAULT_WAIT_MS = 2000;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs an AI call; after a rate-limit error, waits the time the provider
 * asked for (at most maxWaitMs) and tries once more. Other errors, and a
 * second rate-limit error, are thrown to the caller.
 */
export async function retryOnRateLimit<T>(
  call: () => Promise<T>,
  options: { maxWaitMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof RateLimitExceededException)) throw error;
    const wait = Math.min(
      error.retryAfterMs ?? DEFAULT_WAIT_MS,
      options.maxWaitMs ?? 10_000,
    );
    await (options.sleep ?? pause)(wait);
    return call();
  }
}
