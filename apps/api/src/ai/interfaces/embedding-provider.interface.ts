import type { EmbeddingProviderName } from '@ai/constants';
import type { EmbeddingRequest, EmbeddingResponse } from '@ai/types';

/**
 * Contract that every embedding provider must implement.
 * Providers are selected at runtime via the EMBEDDING_PROVIDER environment variable.
 */
export interface IEmbeddingProvider {
  /** Provider identifier */
  readonly name: EmbeddingProviderName;

  /** Default embedding model for this provider */
  readonly defaultModel: string;

  /** Vector dimensions produced by the default model */
  readonly defaultDimensions: number;

  /**
   * Returns true when the provider is configured and ready to accept requests.
   */
  isAvailable(): boolean;

  /**
   * Generate embeddings for a batch of text inputs.
   * @throws {ProviderUnavailableException} when the provider is not configured
   * @throws {InvalidModelException} when the requested model is not supported
   * @throws {TokenLimitExceededException} when input exceeds token limits
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Returns the list of embedding models supported by this provider.
   */
  getSupportedModels(): string[];
}
