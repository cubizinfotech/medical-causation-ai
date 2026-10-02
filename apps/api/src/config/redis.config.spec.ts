import { parseRedisUrl, redisConfig } from './redis.config';

describe('redisConfig', () => {
  const keys = [
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'REDIS_DB',
  ] as const;
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses REDIS_URL for both the client and the BullMQ host', () => {
    process.env.REDIS_URL = 'redis://:secret@redis.internal:6380/2';
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6379';

    const settings = redisConfig();

    expect(settings.url).toBe('redis://:secret@redis.internal:6380/2');
    expect(settings.host).toBe('redis.internal');
    expect(settings.port).toBe(6380);
    expect(settings.password).toBe('secret');
    expect(settings.db).toBe(2);
  });

  it('parses a URL without a password', () => {
    expect(parseRedisUrl('redis://127.0.0.1:6379/0')).toEqual({
      host: '127.0.0.1',
      port: 6379,
      password: '',
      db: 0,
    });
  });
});
