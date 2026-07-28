import type { LlmProviderName } from '@ai/constants';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';

/**
 * Contract that every LLM provider must implement.
 * Providers are selected at runtime via the AI_PROVIDER environment variable.
 */
export interface ILlmProvider {
  /** Provider identifier */
  readonly name: LlmProviderName;

  /** Default model for this provider */
  readonly defaultModel: string;

  /**
   * Returns true when the provider is configured and ready to accept requests.
   * Checks API key presence and required configuration.
   */
  isAvailable(): boolean;

  /**
   * Execute a chat completion request.
   * @throws {ProviderUnavailableException} when the provider is not configured
   * @throws {InvalidModelException} when the requested model is not supported
   * @throws {RateLimitExceededException} when rate limits are hit
   * @throws {TokenLimitExceededException} when token limits are exceeded
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;

  /**
   * Returns the list of models supported by this provider.
   */
  getSupportedModels(): string[];
}
