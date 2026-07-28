import type { EmbeddingProviderName } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { IEmbeddingProvider } from '@ai/interfaces';
import type { EmbeddingRequest, EmbeddingResponse } from '@ai/types';
import {
  ConfigurationErrorException,
  ProviderUnavailableException,
} from '@ai/exceptions';

/**
 * Abstract base class for embedding providers.
 * Concrete providers extend this and implement provider-specific API integration.
 */
export abstract class BaseEmbeddingProvider implements IEmbeddingProvider {
  abstract readonly name: EmbeddingProviderName;
  abstract readonly defaultModel: string;
  abstract readonly defaultDimensions: number;

  constructor(protected readonly settings: AIProviderSettings) {}

  isAvailable(): boolean {
    if (this.name === 'ollama') {
      return Boolean(this.settings.baseUrl);
    }
    return Boolean(this.settings.apiKey);
  }

  getSupportedModels(): string[] {
    return [this.defaultModel];
  }

  abstract embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  protected validateConfiguration(): void {
    if (!this.isAvailable()) {
      throw new ProviderUnavailableException(
        this.name,
        'Provider is not configured',
      );
    }
  }

  protected notConfigured(): never {
    throw new ConfigurationErrorException(
      `Embedding provider "${this.name}" is not configured`,
    );
  }
}
