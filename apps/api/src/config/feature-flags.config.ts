import type { FeatureFlags } from './config.types';

export const featureFlagsConfig = (): FeatureFlags => ({
  enableAiProcessing: process.env.FEATURE_AI_PROCESSING === 'true',
  enableRag: process.env.FEATURE_RAG === 'true',
  enableLiteratureSearch: process.env.FEATURE_LITERATURE_SEARCH === 'true',
  enableMca: process.env.FEATURE_MCA !== 'false',
  enableEwi: process.env.FEATURE_EWI !== 'false',
  enableEmail: process.env.FEATURE_EMAIL === 'true',
  enableAuth: process.env.FEATURE_AUTH === 'true',
});
