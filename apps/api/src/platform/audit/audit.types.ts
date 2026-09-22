import type { ProductId } from '../products';

/**
 * Shared audit / history event contract (future durable store).
 * Do not log secrets or unnecessary PII.
 */
export interface AuditEvent {
  product: ProductId | 'platform';
  action: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface IAuditService {
  record(event: AuditEvent): Promise<void>;
}
