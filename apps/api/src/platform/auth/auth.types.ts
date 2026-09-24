import type { PlatformRole } from '../users/user.types';

/**
 * Authentication infrastructure.
 * Shared login/JWT contracts — product permissions stay product-scoped.
 */
export interface AuthUserRef {
  id: string;
  email: string;
  displayName: string;
  roles: PlatformRole[];
  tenantId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: PlatformRole[];
}

export interface IAuthService {
  /**
   * Validate a bearer token and return the authenticated user reference.
   */
  validateAccessToken(token: string): Promise<AuthUserRef | null>;
}
