import type { EmbeddingConfigSettings } from './ai-config.types';
import { DEFAULT_EMBEDDING_PROVIDER } from '@ai/constants';

function resolveGoogleApiKey(): string {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
}

export const embeddingConfig = (): EmbeddingConfigSettings => ({
  provider: process.env.EMBEDDING_PROVIDER ?? DEFAULT_EMBEDDING_PROVIDER,
  model: process.env.AI_EMBEDDING_MODEL ?? '',
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  batchSize: Number(process.env.EMBEDDING_BATCH_SIZE ?? 100),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    organization: process.env.OPENAI_ORGANIZATION,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  },
  google: {
    apiKey: resolveGoogleApiKey(),
    baseUrl:
      process.env.GOOGLE_BASE_URL ??
      'https://generativelanguage.googleapis.com',
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY ?? '',
    baseUrl: process.env.VOYAGE_BASE_URL ?? 'https://api.voyageai.com/v1',
  },
  jina: {
    apiKey: process.env.JINA_API_KEY ?? '',
    baseUrl: process.env.JINA_BASE_URL ?? 'https://api.jina.ai/v1',
  },
  nomic: {
    apiKey: process.env.NOMIC_API_KEY ?? '',
    baseUrl: process.env.NOMIC_BASE_URL ?? 'https://api-atlas.nomic.ai/v1',
  },
  ollama: {
    apiKey: process.env.OLLAMA_API_KEY ?? '',
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    baseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  },
});
