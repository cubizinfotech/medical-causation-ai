import { DEFAULT_EMBEDDING_MODELS, EMBEDDING_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import {
  OpenAiCompatibleEmbeddingProvider,
  type EmbeddingRuntimeOptions,
} from '../base/openai-compatible-embedding.provider';

export class OpenRouterEmbeddingProvider extends OpenAiCompatibleEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.OPENROUTER;
  readonly defaultModel =
    DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.OPENROUTER];
  readonly defaultDimensions = 1536;

  constructor(settings: AIProviderSettings, runtime: EmbeddingRuntimeOptions) {
    super(settings, runtime);
  }

  protected override getExtraHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://medical-causation-ai.local',
      'X-Title': 'Medical Causation AI',
    };
  }
}
