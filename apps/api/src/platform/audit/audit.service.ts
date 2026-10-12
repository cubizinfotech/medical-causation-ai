import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import type { AuditEvent } from './audit.types';

/**
 * Append-only audit trail (platform.audit_events). Recording never fails the
 * request it describes: a write error is logged and dropped.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          product: event.product,
          action: event.action,
          actorId: event.actorId ?? null,
          resourceType: event.resourceType ?? null,
          resourceId: event.resourceId ?? null,
          metadata: event.metadata ?? undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event ${event.action} not saved: ${message}`);
    }
  }
}
