import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_RATE_LIMIT } from './rate-limit';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * In-memory request limits. The API runs as one process (see
 * ecosystem.config.js), so the counters do not need to be shared.
 * Registered after AuthModule, so signed-in requests count per user.
 */
@Module({
  imports: [ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT])],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitModule {}
