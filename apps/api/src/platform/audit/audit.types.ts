import type { ProductId } from '../products';

/**
 * One audit entry: who did what to which record. Never put secrets or
 * patient details in metadata; ids and counts are enough.
 */
export interface AuditEvent {
  product: ProductId | 'platform';
  action: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
