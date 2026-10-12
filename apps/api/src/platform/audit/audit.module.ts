import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Shared audit trail. MCA, EWI, and auth record access through it. */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
