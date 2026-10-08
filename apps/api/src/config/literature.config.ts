import type { LiteratureSearchSettings } from './config.types';

export const literatureConfig = (): LiteratureSearchSettings => ({
  // On unless explicitly turned off. Only medical search terms leave the
  // server, never patient details.
  enabled: process.env.FEATURE_LITERATURE_SEARCH !== 'false',
  pubmedBaseUrl:
    process.env.PUBMED_BASE_URL ??
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  europePmcBaseUrl:
    process.env.EUROPE_PMC_BASE_URL ??
    'https://www.ebi.ac.uk/europepmc/webservices/rest',
  pubmedApiKey: process.env.PUBMED_API_KEY?.trim() || undefined,
  tool: process.env.PUBMED_TOOL?.trim() || 'medical-causation-ai',
  email: process.env.PUBMED_EMAIL?.trim() || undefined,
  maxResults: Number(process.env.LITERATURE_MAX_RESULTS ?? 8),
  resultsPerQuery: Number(process.env.LITERATURE_RESULTS_PER_QUERY ?? 20),
  timeoutMs: Number(process.env.LITERATURE_REQUEST_TIMEOUT_MS ?? 15000),
});
