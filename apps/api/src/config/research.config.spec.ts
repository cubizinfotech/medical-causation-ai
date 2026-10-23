import { researchConfig } from './research.config';

describe('researchConfig', () => {
  const keys = [
    'RESEARCH_PROVIDER',
    'RESEARCH_REQUEST_TIMEOUT_MS',
    'RESEARCH_RETRY_MAX_ATTEMPTS',
    'RESEARCH_RETRY_DELAY_MS',
    'RESEARCH_MIN_INTERVAL_MS',
    'COURTLISTENER_API_TOKEN',
    'COURTLISTENER_API_KEY',
    'OPENALEX_API_KEY',
    'PUBMED_API_KEY',
    'NCBI_API_KEY',
    'PUBMED_EMAIL',
    'YOUTUBE_API_KEY',
    'YOUTUBE_MAX_RESULTS',
    'ASSEMBLYAI_API_KEY',
    'EWI_TRANSCRIPTION_ENABLED',
    'EWI_TRANSCRIPTION_MAX_FILES',
    'EWI_TRANSCRIPTION_MAX_MINUTES',
    'PUBMED_MAX_ARTICLES',
    'WEB_SEARCH_MAX_QUERIES',
    'WEB_FETCH_MAX_PAGES',
    'OPENALEX_MAILTO',
    'CROSSREF_MAILTO',
    'ORCID_CLIENT_ID',
    'ORCID_CLIENT_SECRET',
    'WEB_SEARCH_PROVIDERS',
    'SERPER_API_KEY',
    'BRAVE_SEARCH_API_KEY',
    'TAVILY_API_KEY',
    'WEB_SEARCH_MAX_PAGES',
    'WEB_RESEARCH_DEADLINE_MS',
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
    expect(config.web.maxFetchPages).toBe(80);
    expect(config.web.maxQueries).toBe(64);
    expect(config.web.deadlineMs).toBe(180000);
    expect(config.web.serperApiKey).toBeUndefined();
    expect(config.web.braveApiKey).toBeUndefined();
    expect(config.web.tavilyApiKey).toBeUndefined();
    expect(config.crossrefMailto).toBeUndefined();
    expect(config.orcidClientId).toBeUndefined();
    expect(config.orcidClientSecret).toBeUndefined();
    expect(config.courtListenerToken).toBeUndefined();
    expect(config.openAlexApiKey).toBeUndefined();
    expect(config.pubmedApiKey).toBeUndefined();
    expect(config.youtubeApiKey).toBeUndefined();
    expect(config.youtubeMaxResults).toBe(25);
    expect(config.assemblyAiApiKey).toBeUndefined();
    expect(config.transcriptionEnabled).toBe(true);
    expect(config.transcriptionMaxFiles).toBe(2);
    expect(config.pubmedMaxArticles).toBe(40);
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

  it('reads provider keys through the documented environment names and aliases', () => {
    process.env.COURTLISTENER_API_KEY = 'cl-alias-token';
    process.env.OPENALEX_API_KEY = 'openalex-test-key';
    process.env.NCBI_API_KEY = 'ncbi-alias-key';
    process.env.PUBMED_EMAIL = 'research@example.test';
    process.env.YOUTUBE_API_KEY = 'youtube-test-key';
    process.env.YOUTUBE_MAX_RESULTS = '6';
    process.env.SERPER_API_KEY = 'serper-test-key';
    process.env.ASSEMBLYAI_API_KEY = 'assembly-test-key';
    const config = researchConfig();
    expect(config.courtListenerToken).toBe('cl-alias-token');
    expect(config.openAlexApiKey).toBe('openalex-test-key');
    expect(config.pubmedApiKey).toBe('ncbi-alias-key');
    expect(config.pubmedEmail).toBe('research@example.test');
    expect(config.youtubeApiKey).toBe('youtube-test-key');
    expect(config.youtubeMaxResults).toBe(6);
    expect(config.web.serperApiKey).toBe('serper-test-key');
    expect(config.assemblyAiApiKey).toBe('assembly-test-key');
  });

  it('prefers COURTLISTENER_API_TOKEN and PUBMED_API_KEY over aliases', () => {
    process.env.COURTLISTENER_API_TOKEN = 'cl-primary-token';
    process.env.COURTLISTENER_API_KEY = 'cl-alias-token';
    process.env.PUBMED_API_KEY = 'pubmed-primary-key';
    process.env.NCBI_API_KEY = 'ncbi-alias-key';
    const config = researchConfig();
    expect(config.courtListenerToken).toBe('cl-primary-token');
    expect(config.pubmedApiKey).toBe('pubmed-primary-key');
  });

  it('caps the web-research deadline so one investigation stays within minutes', () => {
    process.env.WEB_RESEARCH_DEADLINE_MS = '420000';
    expect(researchConfig().web.deadlineMs).toBe(240000);
    process.env.WEB_RESEARCH_DEADLINE_MS = '5000';
    expect(researchConfig().web.deadlineMs).toBe(60000);
  });

  it('does not treat a truncated Gemini key as configured for web search', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    process.env.GEMINI_API_KEY = 'Q.' + 'x'.repeat(40);
    expect(researchConfig().web.geminiApiKey).toBeUndefined();
    process.env.GEMINI_API_KEY = 'AQ.' + 'x'.repeat(40);
    expect(researchConfig().web.geminiApiKey).toMatch(/^AQ\./);
    warn.mockRestore();
  });
});
