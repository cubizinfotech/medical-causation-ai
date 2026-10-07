/**
 * Users and roles for shared tenancy.
 * Product feature access uses permission keys like `mca:analyze` / `ewi:investigate`.
 */
export const PLATFORM_ROLES = [
  'super_admin',
  'admin',
  'attorney',
  'paralegal',
  'medical_expert',
  'user',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const USER_LIST_ROLES = [
  'super_admin',
  'admin',
] as const satisfies readonly PlatformRole[];

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  roles: PlatformRole[];
  /** Product-scoped permission claims, e.g. mca:*, ewi:* */
  permissions: string[];
  tenantId?: string;
  jobTitle: string | null;
  organization: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  /** ISO time of the last photo change, or null when there is no photo. */
  avatarUpdatedAt: string | null;
}

export interface ProfileDetailsInput {
  displayName?: string;
  jobTitle?: string | null;
  organization?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
}

export interface IUserService {
  findById(id: string): Promise<PlatformUser | null>;
}
