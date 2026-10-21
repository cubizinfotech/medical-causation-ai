import { researchConfig } from './research.config';

describe('researchConfig', () => {
  const keys = [
    'RESEARCH_PROVIDER',
    'RESEARCH_REQUEST_TIMEOUT_MS',
    'RESEARCH_RETRY_MAX_ATTEMPTS',
    'RESEARCH_RETRY_DELAY_MS',
    'RESEARCH_MIN_INTERVAL_MS',
    'COURTLISTENER_API_TOKEN',
    'OPENALEX_API_KEY',
    'OPENALEX_MAILTO',
    'CROSSREF_MAILTO',
    'ORCID_CLIENT_ID',
    'ORCID_CLIENT_SECRET',
    'WEB_SEARCH_PROVIDERS',
    'SERPER_API_KEY',
    'BRAVE_SEARCH_API_KEY',
    'TAVILY_API_KEY',
    'WEB_SEARCH_MAX_PAGES',
    'GEMINI_API_KEY',
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

  it('defaults to mock research with documented search limits', () => {
    const config = researchConfig();
    expect(config.mode).toBe('mock');
    expect(config.minIntervalMs).toBe(0);
    expect(config.web.maxPages).toBe(150);
    expect(config.web.maxFetchPages).toBe(40);
    expect(config.web.serperApiKey).toBeUndefined();
    expect(config.web.braveApiKey).toBeUndefined();
    expect(config.web.tavilyApiKey).toBeUndefined();
    expect(config.crossrefMailto).toBeUndefined();
    expect(config.orcidClientId).toBeUndefined();
    expect(config.orcidClientSecret).toBeUndefined();
  });

  it('reads optional provider keys without enabling paid search by itself', () => {
    process.env.RESEARCH_PROVIDER = 'live';
    process.env.RESEARCH_MIN_INTERVAL_MS = '250';
    process.env.WEB_SEARCH_MAX_PAGES = '12';
    process.env.CROSSREF_MAILTO = 'research@example.test';
    process.env.OPENALEX_MAILTO = 'openalex@example.test';
    process.env.ORCID_CLIENT_ID = 'APP-PUBLIC-TEST';
    process.env.ORCID_CLIENT_SECRET = 'orcid-secret-test';
    const config = researchConfig();
    expect(config.mode).toBe('live');
    expect(config.minIntervalMs).toBe(250);
    expect(config.web.maxPages).toBe(12);
    expect(config.crossrefMailto).toBe('research@example.test');
    expect(config.openAlexMailto).toBe('openalex@example.test');
    expect(config.orcidClientId).toBe('APP-PUBLIC-TEST');
    expect(config.orcidClientSecret).toBe('orcid-secret-test');
    expect(config.web.serperApiKey).toBeUndefined();
  });
});
