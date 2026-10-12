import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { ReportModule } from './report/report.module';
import { HealthModule } from './health/health.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

/**
 * Shared platform concerns used by MCA and EWI.
 * Product-specific domain logic must not live here.
 */
@Module({
  imports: [
    AuthModule,
    RateLimitModule,
    UsersModule,
    EmailModule,
    AuditModule,
    ReportModule,
    HealthModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    EmailModule,
    AuditModule,
    ReportModule,
    HealthModule,
  ],
})
export class PlatformModule {}
