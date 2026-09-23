import type { ResearchProviderSettings } from './config.types';

export const researchConfig = (): ResearchProviderSettings => {
  const mode = (process.env.RESEARCH_PROVIDER ?? 'mock').trim().toLowerCase();
  return {
    mode: mode === 'live' ? 'live' : 'mock',
    timeoutMs: Number(process.env.RESEARCH_REQUEST_TIMEOUT_MS ?? 20000),
    retryMaxAttempts: Number(process.env.RESEARCH_RETRY_MAX_ATTEMPTS ?? 3),
    retryDelayMs: Number(process.env.RESEARCH_RETRY_DELAY_MS ?? 1000),
    minIntervalMs: Number(process.env.RESEARCH_MIN_INTERVAL_MS ?? 0),
  };
};
