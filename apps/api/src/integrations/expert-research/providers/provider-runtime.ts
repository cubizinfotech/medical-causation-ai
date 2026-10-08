import type {
  ExpertResearchQuery,
  ResearchRunMode,
} from '../expert-research.types';
import type { LiveSourceSettings } from '../live/live-sources';

export interface ProviderRuntimeOptions {
  mode: ResearchRunMode;
  timeoutMs: number;
  minIntervalMs: number;
  /** Settings for the connected public sources in live mode. */
  live?: LiveSourceSettings;
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

/**
 * NPI check digit: Luhn over the first nine digits with the 80840 prefix
 * (CMS NPI standard). Catches most typos before a registry request.
 */
export function isValidNpi(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const digits = `80840${value.slice(0, 9)}`.split('').map(Number);
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    // Double every second digit from the right of the check-digit position.
    const fromRight = digits.length - index;
    let digit = digits[index];
    if (fromRight % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[9]);
}

export function validateExpertResearchQuery(query: {
  expertName?: string;
  city?: string;
  specialty?: string;
  npi?: string;
}): QueryValidation {
  const expertName = query.expertName?.trim() ?? '';
  const city = query.city?.trim() ?? '';
  const specialty = query.specialty?.trim() ?? '';
  if (expertName.length < NAME_MIN || expertName.length > NAME_MAX) {
    return {
      ok: false,
      message: 'Expert name must be between 2 and 200 characters.',
    };
  }
  if (city.length < NAME_MIN || city.length > NAME_MAX) {
    return {
      ok: false,
      message: 'City must be between 2 and 200 characters.',
    };
  }
  if (specialty.length < NAME_MIN || specialty.length > NAME_MAX) {
    return {
      ok: false,
      message: 'Medical specialty must be between 2 and 200 characters.',
    };
  }
  const npi = query.npi?.replace(/\s+/g, '') ?? '';
  if (npi && !isValidNpi(npi)) {
    return {
      ok: false,
      message: 'NPI must be a valid 10-digit National Provider Identifier.',
    };
  }
  return {
    ok: true,
    value: npi
      ? { expertName, city, specialty, npi }
      : { expertName, city, specialty },
  };
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
