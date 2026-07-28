import type { LlmProviderName, EmbeddingProviderName } from '@ai/constants';

/**
 * Token usage metrics for a single AI operation.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extended usage metadata including cost estimation and timing.
 * Cost fields are informational only — billing is not implemented.
 */
export interface AiUsageMetrics extends TokenUsage {
  /** Estimated cost in USD (informational, not used for billing) */
  estimatedCostUsd?: number;
  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
  /** LLM or embedding provider that served the request */
  provider: LlmProviderName | EmbeddingProviderName;
  /** Model identifier used for the operation */
  model: string;
}

/**
 * Aggregated token usage across multiple AI operations.
 */
export interface AggregatedTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  operationCount: number;
}

/**
 * Configuration for token limits and cost estimation.
 */
export interface TokenLimitConfig {
  maxPromptTokens: number;
  maxCompletionTokens: number;
  maxTotalTokens: number;
  costPerPromptTokenUsd?: number;
  costPerCompletionTokenUsd?: number;
}
