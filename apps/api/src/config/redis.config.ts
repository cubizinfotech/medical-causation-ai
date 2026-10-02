import type { RedisSettings } from './config.types';

export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password: string;
  db: number;
} | null {
  try {
    const parsed = new URL(url);
    const dbText = parsed.pathname.replace(/^\//, '');
    const db = dbText ? Number(dbText) : 0;
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      password: decodeURIComponent(parsed.password),
      db: Number.isFinite(db) ? db : 0,
    };
  } catch {
    return null;
  }
}

export const redisConfig = (): RedisSettings => {
  const fallbackHost = process.env.REDIS_HOST ?? 'localhost';
  const fallbackPort = Number(process.env.REDIS_PORT ?? 6379);
  const fallbackPassword = process.env.REDIS_PASSWORD ?? '';
  const fallbackDb = Number(process.env.REDIS_DB ?? 0);
  const authSegment = fallbackPassword
    ? `:${encodeURIComponent(fallbackPassword)}@`
    : '';
  const url =
    process.env.REDIS_URL ??
    `redis://${authSegment}${fallbackHost}:${fallbackPort}/${fallbackDb}`;
  const parsed = parseRedisUrl(url);

  return {
    url,
    host: parsed?.host || fallbackHost,
    port: parsed?.port || fallbackPort,
    password: parsed ? parsed.password : fallbackPassword,
    db: parsed?.db ?? fallbackDb,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'mca:',
    ttlSeconds: Number(process.env.REDIS_TTL_SECONDS ?? 3600),
  };
};
