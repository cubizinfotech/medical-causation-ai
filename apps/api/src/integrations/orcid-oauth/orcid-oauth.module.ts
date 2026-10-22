import { Module } from '@nestjs/common';
import { AuditModule } from '@platform/audit/audit.module';
import { OrcidOAuthController } from './orcid-oauth.controller';
import { OrcidOAuthService } from './orcid-oauth.service';

@Module({
  imports: [AuditModule],
  controllers: [OrcidOAuthController],
  providers: [OrcidOAuthService],
  exports: [OrcidOAuthService],
})
export class OrcidOAuthModule {}
