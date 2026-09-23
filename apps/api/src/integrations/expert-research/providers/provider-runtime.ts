import type {
  ExpertResearchQuery,
  ResearchRunMode,
} from '../expert-research.types';

export interface ProviderRuntimeOptions {
  mode: ResearchRunMode;
  timeoutMs: number;
  minIntervalMs: number;
}

const NAME_MIN = 2;
const NAME_MAX = 200;

export class ProviderTimeoutError extends Error {
  constructor() {
    super('Provider timed out');
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms.`);
    this.name = 'ProviderRateLimitError';
  }
}

export type QueryValidation =
  { ok: true; value: ExpertResearchQuery } | { ok: false; message: string };

export function validateExpertResearchQuery(query: {
  expertName?: string;
  specialty?: string;
}): QueryValidation {
  const expertName = query.expertName?.trim() ?? '';
  const specialty = query.specialty?.trim() ?? '';
  if (expertName.length < NAME_MIN || expertName.length > NAME_MAX) {
    return {
      ok: false,
      message: 'Expert name must be between 2 and 200 characters.',
    };
  }
  if (specialty.length < NAME_MIN || specialty.length > NAME_MAX) {
    return {
      ok: false,
      message: 'Medical specialty must be between 2 and 200 characters.',
    };
  }
  return { ok: true, value: { expertName, specialty } };
}

export function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) return work;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ProviderTimeoutError()),
      timeoutMs,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('Provider failed'));
      },
    );
  });
}

/** In-process gap between calls to the same provider. */
export class ProviderRateLimiter {
  private readonly nextAllowed = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  acquire(providerId: string, minIntervalMs: number): void {
    if (minIntervalMs <= 0) return;
    const now = this.now();
    const next = this.nextAllowed.get(providerId) ?? 0;
    if (now < next) {
      throw new ProviderRateLimitError(next - now);
    }
    this.nextAllowed.set(providerId, now + minIntervalMs);
  }
}
