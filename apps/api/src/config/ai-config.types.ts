import type { AIProviderSettings } from './config.types';

/**
 * Per-provider LLM configuration.
 */
export interface ProviderConfigSettings {
  activeProvider: string;
  chatModel: string;
  temperature: number;
  maxTokens: number;
  openai: AIProviderSettings;
  anthropic: AIProviderSettings;
  google: AIProviderSettings;
  azureOpenai: AIProviderSettings;
  openrouter: AIProviderSettings;
  groq: AIProviderSettings;
}

/**
 * Embedding provider configuration.
 */
export interface EmbeddingConfigSettings {
  provider: string;
  model: string;
  dimensions: number;
  batchSize: number;
  openai: AIProviderSettings;
  openrouter: AIProviderSettings;
  google: AIProviderSettings;
  voyage: AIProviderSettings;
  jina: AIProviderSettings;
  nomic: AIProviderSettings;
  ollama: AIProviderSettings;
  groq: AIProviderSettings;
}

/**
 * Prompt management configuration.
 */
export interface PromptConfigSettings {
  /** Base directory for prompt template files */
  templatesDir: string;
  /** Default template version tag */
  defaultVersion: string;
  /** Whether to cache loaded templates in memory */
  cacheEnabled: boolean;
  /** Cache TTL in seconds (0 = no expiry) */
  cacheTtlSeconds: number;
}

/**
 * Token limit and cost estimation configuration.
 */
export interface TokenConfigSettings {
  maxPromptTokens: number;
  maxCompletionTokens: number;
  maxTotalTokens: number;
  /** Estimated cost per 1K prompt tokens in USD (informational) */
  costPer1kPromptTokensUsd: number;
  /** Estimated cost per 1K completion tokens in USD (informational) */
  costPer1kCompletionTokensUsd: number;
}
