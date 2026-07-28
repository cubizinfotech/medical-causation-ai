import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_EMBEDDING_MODELS,
  EMBEDDING_PROVIDERS,
  type EmbeddingProviderName,
} from '@ai/constants';
import type { IEmbeddingProvider } from '@ai/interfaces';
import { ConfigurationErrorException } from '@ai/exceptions';
import type { EmbeddingConfigSettings } from '@config/ai-config.types';
import type { IndexingConfigSettings } from '@config/config.types';
import { AiConfigService } from '@ai/config';
import { OpenAiEmbeddingProvider } from './embeddings/openai-embedding.provider';
import { OpenRouterEmbeddingProvider } from './embeddings/openrouter-embedding.provider';
import {
  GeminiEmbeddingProvider,
  VoyageEmbeddingProvider,
  JinaEmbeddingProvider,
  NomicEmbeddingProvider,
  OllamaEmbeddingProvider,
  GroqEmbeddingProvider,
} from './embeddings/gemini-embedding.provider';
import type { EmbeddingRuntimeOptions } from './base/openai-compatible-embedding.provider';

/**
 * Factory that resolves the active embedding provider based on EMBEDDING_PROVIDER env variable.
 */
@Injectable()
export class EmbeddingProviderFactory {
  private readonly providers: Map<EmbeddingProviderName, IEmbeddingProvider>;

  constructor(
    private readonly aiConfigService: AiConfigService,
    configService: ConfigService,
  ) {
    const embedding = aiConfigService.embedding;
    const indexing = configService.get<IndexingConfigSettings>('indexing')!;
    const runtime = this.buildRuntimeOptions(embedding, indexing);

    this.providers = new Map<EmbeddingProviderName, IEmbeddingProvider>([
      [
        EMBEDDING_PROVIDERS.OPENAI,
        new OpenAiEmbeddingProvider(embedding.openai, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.OPENROUTER,
        new OpenRouterEmbeddingProvider(embedding.openrouter, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.GEMINI,
        new GeminiEmbeddingProvider(embedding.google, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.VOYAGE,
        new VoyageEmbeddingProvider(embedding.voyage, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.JINA,
        new JinaEmbeddingProvider(embedding.jina, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.NOMIC,
        new NomicEmbeddingProvider(embedding.nomic, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.OLLAMA,
        new OllamaEmbeddingProvider(embedding.ollama, runtime),
      ],
      [
        EMBEDDING_PROVIDERS.GROQ,
        new GroqEmbeddingProvider(embedding.groq, runtime),
      ],
    ]);
  }

  getActiveProvider(): IEmbeddingProvider {
    const providerName = this.aiConfigService.activeEmbeddingProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new ConfigurationErrorException(
        `Unknown embedding provider "${providerName}". Supported: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    return provider;
  }

  getProvider(name: EmbeddingProviderName): IEmbeddingProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new ConfigurationErrorException(
        `Unknown embedding provider "${name}"`,
      );
    }

    return provider;
  }

  getAllProviders(): IEmbeddingProvider[] {
    return Array.from(this.providers.values());
  }

  resolveModel(provider: IEmbeddingProvider, model?: string): string {
    if (model) return model;

    const configured = this.aiConfigService.embeddingModel;
    if (configured) return configured;

    return provider.defaultModel;
  }

  getDefaultModel(name: EmbeddingProviderName): string {
    return DEFAULT_EMBEDDING_MODELS[name];
  }

  private buildRuntimeOptions(
    embedding: EmbeddingConfigSettings,
    indexing: IndexingConfigSettings,
  ): EmbeddingRuntimeOptions {
    return {
      dimensions: embedding.dimensions,
      timeoutMs: indexing.embeddingRequestTimeoutMs,
      maxRetries: indexing.embeddingRetryMaxAttempts,
      retryDelayMs: indexing.embeddingRetryDelayMs,
    };
  }
}
