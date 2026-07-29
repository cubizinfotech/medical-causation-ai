import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisSettings } from '@config/config.types';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

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

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  getConnectionOptions(): { host: string; port: number; password?: string; db: number } {
    const redis = this.configService.get<RedisSettings>('redis')!;
    return {
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
    };
  }

  getTtlSeconds(): number {
    return (
      Number(process.env.ANALYSIS_JOB_TTL_SECONDS) ||
      this.configService.get<RedisSettings>('redis')!.ttlSeconds
    );
  }
}
