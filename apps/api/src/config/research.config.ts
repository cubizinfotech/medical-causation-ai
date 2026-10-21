import type { ResearchProviderSettings } from './config.types';

export const researchConfig = (): ResearchProviderSettings => {
  const mode = (process.env.RESEARCH_PROVIDER ?? 'mock').trim().toLowerCase();
  return {
    mode: mode === 'live' ? 'live' : 'mock',
    timeoutMs: Number(process.env.RESEARCH_REQUEST_TIMEOUT_MS ?? 20000),
    retryMaxAttempts: Number(process.env.RESEARCH_RETRY_MAX_ATTEMPTS ?? 3),
    retryDelayMs: Number(process.env.RESEARCH_RETRY_DELAY_MS ?? 1000),
    minIntervalMs: Number(process.env.RESEARCH_MIN_INTERVAL_MS ?? 0),
    courtListenerToken:
      process.env.COURTLISTENER_API_TOKEN?.trim() || undefined,
    courtListenerTimeoutMs: Number(
      process.env.COURTLISTENER_TIMEOUT_MS ?? 60000,
    ),
    openAlexApiKey: process.env.OPENALEX_API_KEY?.trim() || undefined,
    openAlexMailto: process.env.OPENALEX_MAILTO?.trim() || undefined,
    crossrefMailto: process.env.CROSSREF_MAILTO?.trim() || undefined,
    orcidClientId: process.env.ORCID_CLIENT_ID?.trim() || undefined,
    orcidClientSecret: process.env.ORCID_CLIENT_SECRET?.trim() || undefined,
    openPaymentsYears: Number(process.env.OPEN_PAYMENTS_YEARS ?? 7),
    web: {
      providers: (
        process.env.WEB_SEARCH_PROVIDERS ??
        'gemini_grounding,serper,brave,tavily,google_news_rss,gdelt'
      )
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean),
      serperApiKey: process.env.SERPER_API_KEY?.trim() || undefined,
      braveApiKey: process.env.BRAVE_SEARCH_API_KEY?.trim() || undefined,
      tavilyApiKey: process.env.TAVILY_API_KEY?.trim() || undefined,
      geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
      geminiModel:
        process.env.WEB_SEARCH_GEMINI_MODEL?.trim() ||
        process.env.GEMINI_LLM_MODEL?.trim() ||
        undefined,
      maxQueries: Number(process.env.WEB_SEARCH_MAX_QUERIES ?? 44),
      maxPages: Number(process.env.WEB_SEARCH_MAX_PAGES ?? 150),
      searchTimeoutMs: Number(process.env.WEB_SEARCH_TIMEOUT_MS ?? 45000),
      fetchTimeoutMs: Number(process.env.WEB_FETCH_TIMEOUT_MS ?? 15000),
      maxFetchPages: Number(process.env.WEB_FETCH_MAX_PAGES ?? 40),
      deadlineMs: Number(process.env.WEB_RESEARCH_DEADLINE_MS ?? 420000),
      archiveFallback:
        (process.env.WEB_ARCHIVE_FALLBACK ?? 'true').trim().toLowerCase() !==
        'false',
    },
  };
};
