import { DEFAULT_EMBEDDING_MODELS, EMBEDDING_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import {
  OpenAiCompatibleEmbeddingProvider,
  type EmbeddingRuntimeOptions,
} from '../base/openai-compatible-embedding.provider';

export class OpenAiEmbeddingProvider extends OpenAiCompatibleEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.OPENAI;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.OPENAI];
  readonly defaultDimensions = 1536;

  constructor(settings: AIProviderSettings, runtime: EmbeddingRuntimeOptions) {
    super(settings, runtime);
  }
}
