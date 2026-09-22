/**
 * Users and roles (future shared tenancy).
 * Product feature access uses permission keys like `mca:analyze` / `ewi:investigate`.
 */
export type PlatformRole =
  'attorney' | 'paralegal' | 'medical_expert' | 'admin';

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  roles: PlatformRole[];
  /** Product-scoped permission claims, e.g. mca:*, ewi:* */
  permissions: string[];
  tenantId?: string;
}

export interface IUserService {
  findById(id: string): Promise<PlatformUser | null>;
}
