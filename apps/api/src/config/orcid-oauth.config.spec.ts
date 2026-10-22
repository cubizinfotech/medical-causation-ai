import { orcidOAuthConfig, orcidRedirectUriFrom } from './orcid-oauth.config';

describe('orcidOAuthConfig', () => {
  const keys = [
    'ORCID_CLIENT_ID',
    'ORCID_CLIENT_SECRET',
    'ORCID_REDIRECT_URI',
    'API_PUBLIC_URL',
    'ORCID_AUTHORIZE_URL',
    'ORCID_TOKEN_URL',
  ];
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('derives the callback from API_PUBLIC_URL without doubling /api', () => {
    process.env.API_PUBLIC_URL = 'https://157.230.156.87/api';
    const config = orcidOAuthConfig();
    expect(config.redirectUri).toBe(
      'https://157.230.156.87/api/orcid/callback',
    );
    expect(config.redirectUri).not.toMatch(/\/api\/api\//);
    expect(config.clientId).toBeUndefined();
    expect(config.clientSecret).toBeUndefined();
  });

  it('uses ORCID_REDIRECT_URI when set', () => {
    process.env.API_PUBLIC_URL = 'https://api.example.com';
    process.env.ORCID_REDIRECT_URI = 'https://api.example.com/orcid/callback';
    process.env.ORCID_CLIENT_ID = 'APP-PUBLIC-TEST';
    process.env.ORCID_CLIENT_SECRET = 'orcid-secret-test';
    const config = orcidOAuthConfig();
    expect(config.redirectUri).toBe('https://api.example.com/orcid/callback');
    expect(config.clientId).toBe('APP-PUBLIC-TEST');
    expect(config.clientSecret).toBe('orcid-secret-test');
  });
});

describe('orcidRedirectUriFrom', () => {
  it('strips a trailing slash on the public API base', () => {
    expect(orcidRedirectUriFrom('http://localhost:3001/')).toBe(
      'http://localhost:3001/orcid/callback',
    );
  });
});
