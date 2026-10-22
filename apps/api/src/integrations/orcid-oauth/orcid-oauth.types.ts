export const ORCID_OAUTH_SCOPE = '/authenticate';

export const ORCID_OAUTH_RESULTS = [
  'connected',
  'denied',
  'invalid_state',
  'expired_state',
  'missing_code',
  'token_failed',
  'not_configured',
  'oauth_error',
] as const;

export type OrcidOAuthResult = (typeof ORCID_OAUTH_RESULTS)[number];

export interface OrcidOAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export interface OrcidOAuthStateRecord {
  userId: string;
  codeVerifier: string;
  expiresAt: number;
}

export interface OrcidOAuthConnection {
  userId: string;
  orcid: string;
  name: string | null;
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  expiresAt: number;
}

export interface OrcidOAuthPublicConnection {
  connected: boolean;
  orcid?: string;
  name?: string | null;
}
