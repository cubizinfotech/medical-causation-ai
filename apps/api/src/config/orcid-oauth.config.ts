import type { OrcidOAuthSettings } from './config.types';

export const ORCID_AUTHORIZE_URL = 'https://orcid.org/oauth/authorize';
export const ORCID_OAUTH_TOKEN_URL = 'https://orcid.org/oauth/token';

const DEFAULT_STATE_TTL_SECONDS = 600;

/** Nest route. Caddy's /api prefix is not part of this path. */
export const ORCID_CALLBACK_PATH = '/orcid/callback';

export function orcidRedirectUriFrom(
  apiPublicUrl: string,
  explicit?: string,
): string {
  const override = explicit?.trim();
  if (override) return override;
  return `${apiPublicUrl.replace(/\/+$/, '')}${ORCID_CALLBACK_PATH}`;
}

export const orcidOAuthConfig = (): OrcidOAuthSettings => ({
  clientId: process.env.ORCID_CLIENT_ID?.trim() || undefined,
  clientSecret: process.env.ORCID_CLIENT_SECRET?.trim() || undefined,
  redirectUri: orcidRedirectUriFrom(
    process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
    process.env.ORCID_REDIRECT_URI,
  ),
  authorizeUrl: process.env.ORCID_AUTHORIZE_URL?.trim() || ORCID_AUTHORIZE_URL,
  tokenUrl: process.env.ORCID_TOKEN_URL?.trim() || ORCID_OAUTH_TOKEN_URL,
  timeoutMs: Number(process.env.RESEARCH_REQUEST_TIMEOUT_MS ?? 20000),
  stateTtlSeconds: Number(
    process.env.ORCID_OAUTH_STATE_TTL_SECONDS ?? DEFAULT_STATE_TTL_SECONDS,
  ),
});
