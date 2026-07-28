import type { LlmProviderName } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { ILlmProvider } from '@ai/interfaces';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import {
  ConfigurationErrorException,
  ProviderUnavailableException,
} from '@ai/exceptions';

/**
 * Abstract base class for LLM providers.
 */
export abstract class BaseLlmProvider implements ILlmProvider {
  abstract readonly name: LlmProviderName;
  abstract readonly defaultModel: string;

  constructor(protected readonly settings: AIProviderSettings) {}

  isAvailable(): boolean {
    return Boolean(this.settings.apiKey);
  }

  getSupportedModels(): string[] {
    return [this.defaultModel];
  }

  abstract complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse>;

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
      `LLM provider "${this.name}" is not configured`,
    );
  }
}
