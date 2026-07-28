import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LLM_MODELS,
  LLM_PROVIDERS,
  type LlmProviderName,
} from '@ai/constants';
import type { ILlmProvider } from '@ai/interfaces';
import { ConfigurationErrorException } from '@ai/exceptions';
import type { IndexingConfigSettings } from '@config/config.types';
import { AiConfigService } from '@ai/config';
import { OpenRouterProvider } from './openrouter.provider';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';

@Injectable()
export class LlmProviderFactory {
  private readonly providers: Map<LlmProviderName, ILlmProvider>;

  constructor(
    private readonly aiConfigService: AiConfigService,
    configService: ConfigService,
  ) {
    const config = aiConfigService.provider;
    const indexing = configService.get<IndexingConfigSettings>('indexing')!;
    const runtime = this.buildRuntimeOptions(indexing);

    this.providers = new Map<LlmProviderName, ILlmProvider>([
      [
        LLM_PROVIDERS.OPENROUTER,
        new OpenRouterProvider(config.openrouter, runtime),
      ],
      [LLM_PROVIDERS.OPENAI, new OpenAiProvider(config.openai, runtime)],
      [
        LLM_PROVIDERS.ANTHROPIC,
        new AnthropicProvider(config.anthropic, runtime),
      ],
      [LLM_PROVIDERS.GEMINI, new GeminiProvider(config.google, runtime)],
      [LLM_PROVIDERS.GROQ, new GroqProvider(config.groq, runtime)],
    ]);
  }

  getActiveProvider(): ILlmProvider {
    const providerName = this.aiConfigService.activeLlmProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new ConfigurationErrorException(
        `Unknown LLM provider "${providerName}". Supported: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    return provider;
  }

  getProvider(name: LlmProviderName): ILlmProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new ConfigurationErrorException(`Unknown LLM provider "${name}"`);
    }

    return provider;
  }

  getAllProviders(): ILlmProvider[] {
    return Array.from(this.providers.values());
  }

  resolveModel(provider: ILlmProvider, model?: string): string {
    if (model) return model;

    const configured = this.aiConfigService.chatModel;
    if (configured) return configured;

    return provider.defaultModel;
  }

  getDefaultModel(name: LlmProviderName): string {
    return DEFAULT_LLM_MODELS[name];
  }

  private buildRuntimeOptions(
    indexing: IndexingConfigSettings,
  ): LlmRuntimeOptions {
    return {
      timeoutMs: indexing.embeddingRequestTimeoutMs,
      maxRetries: indexing.embeddingRetryMaxAttempts,
      retryDelayMs: indexing.embeddingRetryDelayMs,
    };
  }
}
