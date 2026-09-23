import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { RedisService } from '@redis/redis.service';

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  liveness(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: process.env.APP_NAME ?? 'api',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const ok = database.status === 'up' && redis.status === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'database check failed';
      this.logger.warn(`Database health check failed: ${message}`);
      return { status: 'down', error: 'unavailable' };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const started = Date.now();
    try {
      const pong = await this.redis.getClient().ping();
      if (pong !== 'PONG') {
        return { status: 'down', error: 'unexpected ping response' };
      }
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'redis check failed';
      this.logger.warn(`Redis health check failed: ${message}`);
      return { status: 'down', error: 'unavailable' };
    }
  }
}
