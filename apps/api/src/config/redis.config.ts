import type { RedisSettings } from './config.types';

export const redisConfig = (): RedisSettings => {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD ?? '';
  const db = Number(process.env.REDIS_DB ?? 0);

  const authSegment = password ? `:${password}@` : '';

  return {
    url: process.env.REDIS_URL ?? `redis://${authSegment}${host}:${port}/${db}`,
    host,
    port,
    password,
    db,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'mca:',
    ttlSeconds: Number(process.env.REDIS_TTL_SECONDS ?? 3600),
  };
};
