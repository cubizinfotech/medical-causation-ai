import type { ProviderConfigSettings } from './ai-config.types';
import { DEFAULT_LLM_PROVIDER } from '@ai/constants';

export const providerConfig = (): ProviderConfigSettings => ({
  activeProvider: process.env.AI_PROVIDER ?? DEFAULT_LLM_PROVIDER,
  chatModel: process.env.AI_CHAT_MODEL ?? '',
  temperature: Number(process.env.AI_TEMPERATURE ?? 0.2),
  maxTokens: Number(process.env.AI_MAX_TOKENS ?? 4096),
  retryMaxAttempts: Number(process.env.AI_RETRY_MAX_ATTEMPTS ?? 8),
  requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 120000),
  retryDelayMs: Number(process.env.AI_RETRY_DELAY_MS ?? 5000),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    organization: process.env.OPENAI_ORGANIZATION,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY ?? '',
    baseUrl:
      process.env.GOOGLE_BASE_URL ??
      'https://generativelanguage.googleapis.com',
  },
  azureOpenai: {
    apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT ?? '',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-15-preview',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    baseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  },
});
