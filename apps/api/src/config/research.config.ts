import { usableGeminiApiKey } from '@ai/utils/gemini-client.util';
import type { ResearchProviderSettings } from './config.types';

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function clampMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const researchConfig = (): ResearchProviderSettings => {
  const mode = (process.env.RESEARCH_PROVIDER ?? 'mock').trim().toLowerCase();
  return {
    mode: mode === 'live' ? 'live' : 'mock',
    timeoutMs: Number(process.env.RESEARCH_REQUEST_TIMEOUT_MS ?? 20000),
    retryMaxAttempts: Number(process.env.RESEARCH_RETRY_MAX_ATTEMPTS ?? 3),
    retryDelayMs: Number(process.env.RESEARCH_RETRY_DELAY_MS ?? 1000),
    minIntervalMs: Number(process.env.RESEARCH_MIN_INTERVAL_MS ?? 0),
    courtListenerToken: firstEnv(
      'COURTLISTENER_API_TOKEN',
      'COURTLISTENER_API_KEY',
    ),
    courtListenerTimeoutMs: Number(
      process.env.COURTLISTENER_TIMEOUT_MS ?? 60000,
    ),
    openAlexApiKey: process.env.OPENALEX_API_KEY?.trim() || undefined,
    openAlexMailto: process.env.OPENALEX_MAILTO?.trim() || undefined,
    crossrefMailto: process.env.CROSSREF_MAILTO?.trim() || undefined,
    orcidClientId: process.env.ORCID_CLIENT_ID?.trim() || undefined,
    orcidClientSecret: process.env.ORCID_CLIENT_SECRET?.trim() || undefined,
    pubmedApiKey: firstEnv('PUBMED_API_KEY', 'NCBI_API_KEY'),
    pubmedEmail: process.env.PUBMED_EMAIL?.trim() || undefined,
    youtubeApiKey: process.env.YOUTUBE_API_KEY?.trim() || undefined,
    youtubeMaxResults: Number(process.env.YOUTUBE_MAX_RESULTS ?? 25),
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY?.trim() || undefined,
    transcriptionEnabled:
      (process.env.EWI_TRANSCRIPTION_ENABLED ?? 'true').trim().toLowerCase() !==
      'false',
    transcriptionMaxFiles: Number(process.env.EWI_TRANSCRIPTION_MAX_FILES ?? 2),
    transcriptionMaxMinutes: Number(
      process.env.EWI_TRANSCRIPTION_MAX_MINUTES ?? 30,
    ),
    pubmedMaxArticles: Number(process.env.PUBMED_MAX_ARTICLES ?? 40),
    courtListenerMaxPages: Number(
      process.env.COURTLISTENER_MAX_PAGES ?? 3,
    ),
    courtListenerMaxHits: Number(process.env.COURTLISTENER_MAX_HITS ?? 80),
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
      geminiApiKey: usableGeminiApiKey(process.env.GEMINI_API_KEY),
      geminiModel:
        process.env.WEB_SEARCH_GEMINI_MODEL?.trim() ||
        process.env.GEMINI_LLM_MODEL?.trim() ||
        undefined,
      maxQueries: Number(process.env.WEB_SEARCH_MAX_QUERIES ?? 64),
      maxPages: Number(process.env.WEB_SEARCH_MAX_PAGES ?? 150),
      searchTimeoutMs: Number(process.env.WEB_SEARCH_TIMEOUT_MS ?? 45000),
      fetchTimeoutMs: Number(process.env.WEB_FETCH_TIMEOUT_MS ?? 15000),
      maxFetchPages: Number(process.env.WEB_FETCH_MAX_PAGES ?? 80),
      deadlineMs: clampMs(
        Number(process.env.WEB_RESEARCH_DEADLINE_MS ?? 180000),
        60_000,
        240_000,
      ),
      archiveFallback:
        (process.env.WEB_ARCHIVE_FALLBACK ?? 'true').trim().toLowerCase() !==
        'false',
    },
  };
};
