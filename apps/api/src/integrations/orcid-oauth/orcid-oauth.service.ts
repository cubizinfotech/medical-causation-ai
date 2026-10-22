import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { AppSettings, OrcidOAuthSettings } from '@config/config.types';
import { AuditService } from '@platform/audit/audit.service';
import { RedisService } from '@redis/redis.service';
import { parseOrcidId } from '@integrations/expert-research/live/orcid.client';
import {
  ORCID_OAUTH_SCOPE,
  type OrcidOAuthCallbackQuery,
  type OrcidOAuthConnection,
  type OrcidOAuthPublicConnection,
  type OrcidOAuthResult,
  type OrcidOAuthStateRecord,
} from './orcid-oauth.types';

const STATE_KEY_PREFIX = 'orcid-oauth:state:';
const CONNECTION_KEY_PREFIX = 'orcid-oauth:user:';
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const DEFAULT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/**
 * Authorization-code OAuth for the signed-in app user. Does not search
 * expert records and does not share tokens with the client-credentials
 * public-search client.
 */
@Injectable()
export class OrcidOAuthService {
  private readonly logger = new Logger(OrcidOAuthService.name);
  /** Tests replace this. Never log the request or response bodies. */
  fetchImpl: typeof fetch = fetch;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  configured(): boolean {
    const settings = this.settings();
    return Boolean(settings.clientId && settings.clientSecret);
  }

  /**
   * Creates a one-time Redis state and PKCE verifier, then returns the
   * ORCID authorize URL. The secret never appears in this URL.
   */
  async start(userId: string): Promise<string> {
    const settings = this.settings();
    if (!settings.clientId || !settings.clientSecret) {
      throw new ServiceUnavailableException(
        'ORCID OAuth is not configured (no API key).',
      );
    }
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const ttl = Math.max(settings.stateTtlSeconds, 60);
    const record: OrcidOAuthStateRecord = {
      userId,
      codeVerifier,
      expiresAt: Date.now() + ttl * 1000,
    };
    try {
      await this.redis
        .getClient()
        .set(STATE_KEY_PREFIX + state, JSON.stringify(record), 'EX', ttl);
    } catch {
      this.logger.warn('ORCID OAuth state could not be stored.');
      throw new ServiceUnavailableException(
        'ORCID OAuth is temporarily unavailable.',
      );
    }

    const url = new URL(settings.authorizeUrl);
    url.searchParams.set('client_id', settings.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', ORCID_OAUTH_SCOPE);
    url.searchParams.set('redirect_uri', settings.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /**
   * Validates state, exchanges the code, and stores the token against the
   * signed-in user from the state record. Always returns a frontend URL
   * with a fixed result code — never tokens, codes, or ORCID error text.
   */
  async handleCallback(query: OrcidOAuthCallbackQuery): Promise<string> {
    const error = text(query.error);
    if (error) {
      return this.finish(error === 'access_denied' ? 'denied' : 'oauth_error');
    }

    const state = text(query.state);
    if (!state || !STATE_PATTERN.test(state)) {
      return this.finish('invalid_state');
    }

    let stored: OrcidOAuthStateRecord | null;
    try {
      stored = await this.consumeState(state);
    } catch (caught) {
      const kind = caught instanceof Error ? caught.name : 'Error';
      this.logger.warn(`ORCID OAuth state store failed (${kind}).`);
      return this.finish('oauth_error');
    }
    if (!stored) return this.finish('invalid_state');
    if (stored.expiresAt <= Date.now()) {
      return this.finish('expired_state');
    }

    const code = text(query.code);
    if (!code) return this.finish('missing_code');

    if (!this.configured()) {
      return this.finish('not_configured');
    }

    try {
      const connection = await this.exchangeCode(code, stored);
      await this.saveConnection(connection);
      void this.audit.record({
        product: 'ewi',
        action: 'orcid.oauth.connected',
        actorId: connection.userId,
        resourceType: 'orcid',
        resourceId: connection.orcid,
      });
      return this.finish('connected');
    } catch (caught) {
      const kind = caught instanceof Error ? caught.name : 'Error';
      this.logger.warn(`ORCID authorization-code exchange failed (${kind}).`);
      return this.finish(
        kind === 'ConnectionStoreError' ? 'oauth_error' : 'token_failed',
      );
    }
  }

  async publicConnection(userId: string): Promise<OrcidOAuthPublicConnection> {
    const connection = await this.readConnection(userId);
    if (!connection) return { connected: false };
    return {
      connected: true,
      orcid: connection.orcid,
      name: connection.name,
    };
  }

  private async exchangeCode(
    code: string,
    stored: OrcidOAuthStateRecord,
  ): Promise<OrcidOAuthConnection> {
    const settings = this.settings();
    const body = new URLSearchParams({
      client_id: settings.clientId!,
      client_secret: settings.clientSecret!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: settings.redirectUri,
      code_verifier: stored.codeVerifier,
    });
    let response: Response;
    try {
      response = await this.fetchImpl(settings.tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(settings.timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      const failure = new Error(
        timedOut
          ? 'ORCID token request timed out.'
          : 'ORCID token request failed.',
      );
      failure.name = timedOut ? 'TimeoutError' : 'NetworkError';
      throw failure;
    }
    if (!response.ok) {
      const failure = new Error('ORCID rejected the authorization code.');
      failure.name = 'HttpError';
      throw failure;
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const accessToken = text(payload.access_token);
    const orcid = parseOrcidId(text(payload.orcid));
    if (!accessToken || !orcid) {
      const failure = new Error('ORCID token response was incomplete.');
      failure.name = 'InvalidResponse';
      throw failure;
    }
    const lifetime = Number(payload.expires_in);
    const ttlSeconds =
      Number.isFinite(lifetime) && lifetime > 0
        ? Math.floor(lifetime)
        : DEFAULT_TOKEN_TTL_SECONDS;
    return {
      userId: stored.userId,
      orcid,
      name: text(payload.name) ?? null,
      accessToken,
      refreshToken: text(payload.refresh_token) ?? null,
      scope: text(payload.scope) ?? ORCID_OAUTH_SCOPE,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
  }

  private async consumeState(
    state: string,
  ): Promise<OrcidOAuthStateRecord | null> {
    let raw: unknown;
    try {
      raw = await this.redis.getClient().getdel(STATE_KEY_PREFIX + state);
    } catch {
      const failure = new Error('ORCID OAuth state store failed.');
      failure.name = 'StateStoreError';
      throw failure;
    }
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<OrcidOAuthStateRecord>;
      if (
        typeof parsed.userId !== 'string' ||
        !parsed.userId ||
        typeof parsed.codeVerifier !== 'string' ||
        !parsed.codeVerifier ||
        typeof parsed.expiresAt !== 'number'
      ) {
        return null;
      }
      return {
        userId: parsed.userId,
        codeVerifier: parsed.codeVerifier,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  private async saveConnection(
    connection: OrcidOAuthConnection,
  ): Promise<void> {
    const ttl = Math.max(
      60,
      Math.floor((connection.expiresAt - Date.now()) / 1000),
    );
    try {
      await this.redis
        .getClient()
        .set(
          CONNECTION_KEY_PREFIX + connection.userId,
          JSON.stringify(connection),
          'EX',
          ttl,
        );
    } catch {
      const failure = new Error('ORCID OAuth connection could not be stored.');
      failure.name = 'ConnectionStoreError';
      throw failure;
    }
  }

  private async readConnection(
    userId: string,
  ): Promise<OrcidOAuthConnection | null> {
    let raw: unknown;
    try {
      raw = await this.redis.getClient().get(CONNECTION_KEY_PREFIX + userId);
    } catch {
      this.logger.warn('ORCID OAuth connection could not be read.');
      throw new ServiceUnavailableException(
        'ORCID OAuth is temporarily unavailable.',
      );
    }
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<OrcidOAuthConnection>;
      const orcid = parseOrcidId(text(parsed.orcid));
      if (
        parsed.userId !== userId ||
        !orcid ||
        typeof parsed.accessToken !== 'string' ||
        !parsed.accessToken
      ) {
        return null;
      }
      return {
        userId,
        orcid,
        name: text(parsed.name) ?? null,
        accessToken: parsed.accessToken,
        refreshToken: text(parsed.refreshToken) ?? null,
        scope: text(parsed.scope) ?? ORCID_OAUTH_SCOPE,
        expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0,
      };
    } catch {
      return null;
    }
  }

  private finish(result: OrcidOAuthResult): string {
    const frontend =
      this.config.get<AppSettings>('app')?.frontendUrl ??
      'http://localhost:3000';
    const url = new URL(frontend);
    url.searchParams.set('orcid_oauth', result);
    return url.toString();
  }

  private settings(): OrcidOAuthSettings {
    const settings = this.config.get<OrcidOAuthSettings>('orcidOAuth');
    if (!settings) {
      throw new Error('ORCID OAuth configuration is not available');
    }
    return settings;
  }
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
