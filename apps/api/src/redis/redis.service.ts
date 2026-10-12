import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { JobsSettings, RedisSettings } from '@config/config.types';

const MAX_UPDATE_ATTEMPTS = 5;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  /** WATCH is per connection, so read-modify-write runs on its own one. */
  private txClient!: Redis;
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const redis = this.configService.get<RedisSettings>('redis');
    if (!redis) {
      throw new Error('Redis configuration is not available');
    }

    this.client = new Redis(redis.url, {
      maxRetriesPerRequest: null,
      keyPrefix: redis.keyPrefix,
    });
    this.txClient = this.client.duplicate();

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    for (const connection of [this.client, this.txClient]) {
      connection.on('error', (error: Error) => {
        this.logger.error(`Redis error: ${error.message}`);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.client?.quit(), this.txClient?.quit()]);
  }

  getClient(): Redis {
    return this.client;
  }

  getConnectionOptions(): {
    host: string;
    port: number;
    password?: string;
    db: number;
  } {
    const redis = this.configService.get<RedisSettings>('redis')!;
    return {
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
    };
  }

  /** How long job progress records stay in Redis. */
  getTtlSeconds(): number {
    return (
      this.configService.get<JobsSettings>('jobs')?.stateTtlSeconds ?? 14400
    );
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.client.set(
      key,
      JSON.stringify(value),
      'EX',
      this.getTtlSeconds(),
    );
  }

  /**
   * Read-modify-write of a JSON record without losing a concurrent update
   * (for example a cancel arriving while the worker reports progress).
   * Returns null when the key does not exist.
   */
  updateJson<T>(key: string, mutate: (current: T) => T): Promise<T | null> {
    const run = async (): Promise<T | null> => {
      for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
        await this.txClient.watch(key);
        const raw = await this.txClient.get(key);
        if (!raw) {
          await this.txClient.unwatch();
          return null;
        }
        const next = mutate(JSON.parse(raw) as T);
        const committed = await this.txClient
          .multi()
          .set(key, JSON.stringify(next), 'EX', this.getTtlSeconds())
          .exec();
        if (committed) return next;
      }
      throw new Error(`Redis record ${key} kept changing; update not saved`);
    };
    const result = this.txQueue.then(run, run);
    this.txQueue = result.catch(() => undefined);
    return result;
  }
}
