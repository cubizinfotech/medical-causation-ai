import type { EmbeddingProviderName } from '@ai/constants';

/**
 * A single text input for embedding generation.
 */
export interface EmbeddingInput {
  id?: string;
  text: string;
  metadata?: Record<string, string>;
}

/**
 * A single embedding vector result.
 */
export interface EmbeddingResult {
  id?: string;
  embedding: number[];
  model: string;
  provider: EmbeddingProviderName;
  dimensions: number;
  usage: import('./token-usage.types').TokenUsage;
  executionTimeMs: number;
}

/**
 * Request payload for batch embedding generation.
 */
export interface EmbeddingRequest {
  inputs: EmbeddingInput[];
  model?: string;
  dimensions?: number;
  /**
   * Caps the provider's retries (EMBEDDING_RETRY_MAX_ATTEMPTS) for a call
   * that someone is waiting on, such as a search query.
   */
  maxAttempts?: number;
}

/**
 * Response from batch embedding generation.
 */
export interface EmbeddingResponse {
  results: EmbeddingResult[];
  model: string;
  provider: EmbeddingProviderName;
  usage: import('./token-usage.types').TokenUsage;
  executionTimeMs: number;
}
