import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { ReportModule } from './report/report.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';

/**
 * Shared platform concerns used by MCA and EWI.
 * Product-specific domain logic must not live here.
 *
 * Already-implemented shared runtime services remain in their existing locations
 * (config/, database/, redis/, ai/, modules/knowledge-base|document-processing|indexing|rag)
 * and are composed via CommonModule — not blindly relocated.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    EmailModule,
    AuditModule,
    ReportModule,
    StorageModule,
    SearchModule,
    HealthModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    EmailModule,
    AuditModule,
    ReportModule,
    StorageModule,
    SearchModule,
    HealthModule,
  ],
})
export class PlatformModule {}
