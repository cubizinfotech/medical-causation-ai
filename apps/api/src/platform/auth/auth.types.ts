/**
 * Authentication infrastructure (future).
 * Shared login/JWT/session contracts — product permissions stay product-scoped.
 */
export interface AuthUserRef {
  id: string;
  email: string;
  tenantId?: string;
}

export interface IAuthService {
  /**
   * Validate a bearer token and return the authenticated user reference.
   * Not implemented yet — scaffold only.
   */
  validateAccessToken(token: string): Promise<AuthUserRef | null>;
}
