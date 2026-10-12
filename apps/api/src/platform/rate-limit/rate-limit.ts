import { Throttle } from '@nestjs/throttler';

const MINUTE = 60_000;

/** Every API route: generous enough for polling job progress. */
export const DEFAULT_RATE_LIMIT = { ttl: MINUTE, limit: 300 };

/** Password guessing: a few tries per minute per address. */
export const LoginRateLimit = () =>
  Throttle({ default: { ttl: MINUTE, limit: 10 } });

/** Starting an analysis or investigation runs paid AI calls. */
export const JobRateLimit = () =>
  Throttle({ default: { ttl: MINUTE, limit: 10 } });

/** File uploads are parsed in the request. */
export const UploadRateLimit = () =>
  Throttle({ default: { ttl: MINUTE, limit: 30 } });
