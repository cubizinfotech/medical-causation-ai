import { ServiceUnavailableException } from '@nestjs/common';
import { OrcidOAuthService } from './orcid-oauth.service';
import type { OrcidOAuthSettings } from '@config/config.types';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const ORCID = '0000-0002-1825-0097';
const OTHER = '0000-0001-2345-6789';
const FRONTEND = 'http://localhost:3000';
const REDIRECT = 'https://157.230.156.87/api/orcid/callback';

describe('OrcidOAuthService', () => {
  it('refuses to start without credentials and does not call ORCID', async () => {
    const { service, fetchImpl } = setup({
      settings: { clientId: undefined, clientSecret: undefined },
    });
    await expect(service.start(USER)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('builds an authorize URL with PKCE and without the client secret', async () => {
    const { service, store } = setup();
    const url = new URL(await service.start(USER));
    expect(url.origin + url.pathname).toBe('https://orcid.org/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('APP-TEST');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('/authenticate');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(url.searchParams.get('code_verifier')).toBeNull();
    expect(url.searchParams.get('client_secret')).toBeNull();
    expect(url.search).not.toMatch(/secret|token/i);
    const state = url.searchParams.get('state');
    expect(state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect([...store.keys()].some((key) => key.endsWith(state!))).toBe(true);
  });

  it('exchanges a valid code and keeps the token off the redirect', async () => {
    const { service, fetchImpl, sent } = setup({
      token: {
        access_token: 'live-access-token',
        refresh_token: 'live-refresh-token',
        expires_in: 3600,
        name: 'Josiah Carberry',
        orcid: ORCID,
        scope: '/authenticate',
      },
    });
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('connected');
    expect(redirect).not.toMatch(
      /live-access-token|live-refresh-token|auth-code-1|secret/i,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('https://orcid.org/oauth/token');
    expect(sent[0]?.body.get('grant_type')).toBe('authorization_code');
    expect(sent[0]?.body.get('code')).toBe('auth-code-1');
    expect(sent[0]?.body.get('redirect_uri')).toBe(REDIRECT);
    expect(sent[0]?.body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sent[0]?.body.get('client_id')).toBe('APP-TEST');
    expect(sent[0]?.body.get('client_secret')).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const view = await service.publicConnection(USER);
    expect(view).toEqual({
      connected: true,
      orcid: ORCID,
      name: 'Josiah Carberry',
    });
    expect(JSON.stringify(view)).not.toMatch(/live-access-token|refresh/i);
  });

  it('rejects a missing or unknown state without exchanging a code', async () => {
    const { service, fetchImpl } = setup();
    const missing = await service.handleCallback({
      code: 'auth-code-1',
      state: undefined,
    });
    expect(resultOf(missing)).toBe('invalid_state');
    const unknown = await service.handleCallback({
      code: 'auth-code-1',
      state: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(resultOf(unknown)).toBe('invalid_state');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a replayed state', async () => {
    const { service, fetchImpl } = setup({
      token: { access_token: 'tok', orcid: ORCID },
    });
    const authorize = new URL(await service.start(USER));
    const state = authorize.searchParams.get('state') ?? undefined;
    expect(resultOf(await service.handleCallback({ code: 'c1', state }))).toBe(
      'connected',
    );
    expect(resultOf(await service.handleCallback({ code: 'c2', state }))).toBe(
      'invalid_state',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats a stored-but-expired state as expired_state', async () => {
    const { service, fetchImpl, store } = setup();
    const authorize = new URL(await service.start(USER));
    const state = authorize.searchParams.get('state')!;
    const key = [...store.keys()].find((entry) => entry.endsWith(state))!;
    const record = JSON.parse(store.get(key)!.value) as {
      userId: string;
      codeVerifier: string;
      expiresAt: number;
    };
    store.set(key, {
      value: JSON.stringify({ ...record, expiresAt: Date.now() - 1000 }),
      expireAt: Date.now() + 60_000,
    });
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state,
    });
    expect(resultOf(redirect)).toBe('expired_state');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps ORCID access_denied without calling the token endpoint', async () => {
    const { service, fetchImpl } = setup();
    const redirect = await service.handleCallback({
      error: 'access_denied',
      state: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(resultOf(redirect)).toBe('denied');
    expect(redirect).not.toMatch(/access_denied|error_description/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not exchange a token when the code is missing', async () => {
    const { service, fetchImpl } = setup();
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('missing_code');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a failed token exchange without exposing the response', async () => {
    const { service } = setup({
      tokenStatus: 400,
      token: { error: 'invalid' },
    });
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('token_failed');
    expect(redirect).not.toMatch(/invalid|auth-code-1|secret/i);
  });

  it('maps a network failure on token exchange to token_failed', async () => {
    const { service } = setup({
      fetchImpl: jest.fn(() => Promise.reject(new Error('ECONNRESET'))),
    });
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('token_failed');
  });

  it('does not associate the ORCID iD with an expert record', async () => {
    const { service } = setup({
      token: { access_token: 'tok', orcid: ORCID, name: 'Josiah Carberry' },
    });
    const authorize = new URL(await service.start(USER));
    await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    const view = await service.publicConnection(USER);
    expect(view.connected).toBe(true);
    expect(view).not.toHaveProperty('expertId');
    expect(view).not.toHaveProperty('investigationId');
  });

  it('keeps one user from reading or overwriting another user connection', async () => {
    const { service } = setup({
      token: { access_token: 'tok-a', orcid: ORCID, name: 'Josiah Carberry' },
    });
    const first = new URL(await service.start(USER));
    expect(
      resultOf(
        await service.handleCallback({
          code: 'code-a',
          state: first.searchParams.get('state') ?? undefined,
        }),
      ),
    ).toBe('connected');

    service.fetchImpl = jest.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'tok-b',
            orcid: OTHER,
            name: 'Other Person',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    ) as typeof fetch;

    const second = new URL(await service.start(OTHER_USER));
    expect(
      resultOf(
        await service.handleCallback({
          code: 'code-b',
          state: second.searchParams.get('state') ?? undefined,
        }),
      ),
    ).toBe('connected');

    const owner = await service.publicConnection(USER);
    const other = await service.publicConnection(OTHER_USER);
    expect(owner).toEqual({
      connected: true,
      orcid: ORCID,
      name: 'Josiah Carberry',
    });
    expect(other).toEqual({
      connected: true,
      orcid: OTHER,
      name: 'Other Person',
    });
    expect(JSON.stringify(owner)).not.toMatch(/tok-a|tok-b|refresh/i);
    expect(JSON.stringify(other)).not.toMatch(/tok-a|tok-b|refresh/i);
  });

  it('maps an incomplete token response without saving a connection', async () => {
    const { service } = setup({
      token: { access_token: 'tok', name: 'Josiah Carberry' },
    });
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('token_failed');
    expect(await service.publicConnection(USER)).toEqual({ connected: false });
  });

  it('maps other ORCID error codes without forwarding the description', async () => {
    const { service, fetchImpl } = setup();
    const redirect = await service.handleCallback({
      error: 'invalid_scope',
      state: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(resultOf(redirect)).toBe('oauth_error');
    expect(redirect).not.toMatch(/invalid_scope|error_description/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses to start when Redis cannot store state', async () => {
    const { service, fetchImpl } = setup({
      set: jest.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    });
    await expect(service.start(USER)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a Redis save failure after a token response', async () => {
    const { service, client } = setup({
      token: { access_token: 'tok', orcid: ORCID },
    });
    const authorize = new URL(await service.start(USER));
    (client.set as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('oauth_error');
    expect(await service.publicConnection(USER)).toEqual({ connected: false });
  });

  it('maps a Redis GETDEL failure without exchanging a code', async () => {
    const { service, fetchImpl } = setup({
      getdel: jest.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    });
    const authorize = new URL(await service.start(USER));
    const redirect = await service.handleCallback({
      code: 'auth-code-1',
      state: authorize.searchParams.get('state') ?? undefined,
    });
    expect(resultOf(redirect)).toBe('oauth_error');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not treat another user payload under this key as connected', async () => {
    const { service, store } = setup();
    store.set(`orcid-oauth:user:${USER}`, {
      value: JSON.stringify({
        userId: OTHER_USER,
        orcid: ORCID,
        name: 'Josiah Carberry',
        accessToken: 'stolen-access-token',
        refreshToken: 'stolen-refresh-token',
        scope: '/authenticate',
        expiresAt: Date.now() + 60_000,
      }),
      expireAt: Date.now() + 60_000,
    });
    const view = await service.publicConnection(USER);
    expect(view).toEqual({ connected: false });
    expect(JSON.stringify(view)).not.toMatch(/stolen|token|refresh/i);
  });
});

function resultOf(redirect: string): string | null {
  return new URL(redirect).searchParams.get('orcid_oauth');
}

function setup(options?: {
  settings?: Partial<OrcidOAuthSettings>;
  token?: Record<string, unknown>;
  tokenStatus?: number;
  fetchImpl?: typeof fetch;
  set?: (
    key: string,
    value: string,
    flag?: string,
    ttl?: number,
  ) => Promise<string>;
  getdel?: (key: string) => Promise<string | null>;
}) {
  const settings: OrcidOAuthSettings = {
    clientId: 'APP-TEST',
    clientSecret: 'orcid-client-secret',
    redirectUri: REDIRECT,
    authorizeUrl: 'https://orcid.org/oauth/authorize',
    tokenUrl: 'https://orcid.org/oauth/token',
    timeoutMs: 1000,
    stateTtlSeconds: 600,
    ...options?.settings,
  };
  const store = new Map<string, { value: string; expireAt: number }>();
  const client = {
    set:
      options?.set ??
      jest.fn((key: string, value: string, flag?: string, ttl?: number) => {
        const seconds = flag === 'EX' && typeof ttl === 'number' ? ttl : 600;
        store.set(key, { value, expireAt: Date.now() + seconds * 1000 });
        return Promise.resolve('OK');
      }),
    get: jest.fn((key: string) => {
      const row = store.get(key);
      if (!row || row.expireAt <= Date.now()) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(row.value);
    }),
    getdel:
      options?.getdel ??
      jest.fn((key: string) => {
        const row = store.get(key);
        store.delete(key);
        if (!row || row.expireAt <= Date.now()) return Promise.resolve(null);
        return Promise.resolve(row.value);
      }),
  };
  const sent: Array<{ url: string; body: URLSearchParams }> = [];
  const fetchImpl =
    options?.fetchImpl ??
    (jest.fn((url: string | URL, init?: RequestInit) => {
      const raw = init?.body;
      const body = new URLSearchParams(typeof raw === 'string' ? raw : '');
      sent.push({ url: String(url), body });
      return Promise.resolve(
        new Response(JSON.stringify(options?.token ?? {}), {
          status: options?.tokenStatus ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }) as typeof fetch);
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'orcidOAuth') return settings;
      if (key === 'app') return { frontendUrl: FRONTEND };
      return undefined;
    }),
  };
  const service = new OrcidOAuthService(
    config as never,
    { getClient: () => client } as never,
    { record: jest.fn(() => Promise.resolve()) } as never,
  );
  service.fetchImpl = fetchImpl;
  return { service, fetchImpl, sent, store, client };
}
