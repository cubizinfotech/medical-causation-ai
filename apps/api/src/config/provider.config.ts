import type { ProviderConfigSettings } from './ai-config.types';
import { DEFAULT_LLM_PROVIDER } from '@ai/constants';

function resolveGoogleApiKey(): string {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
}

export const providerConfig = (): ProviderConfigSettings => ({
  activeProvider:
    process.env.AI_PROVIDER?.trim().toLowerCase() ?? DEFAULT_LLM_PROVIDER,
  chatModel: process.env.AI_CHAT_MODEL ?? '',
  models: {
    openrouter: process.env.OPENROUTER_LLM_MODEL ?? '',
    openai: process.env.OPENAI_LLM_MODEL ?? '',
    anthropic: process.env.ANTHROPIC_LLM_MODEL ?? '',
    gemini: process.env.GEMINI_LLM_MODEL ?? '',
    groq: process.env.GROQ_LLM_MODEL ?? '',
    mistral: process.env.MISTRAL_LLM_MODEL ?? '',
  },
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
    apiKey: resolveGoogleApiKey(),
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
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY ?? '',
    baseUrl: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
  },
});
