import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LLM_MODELS,
  LLM_PROVIDERS,
  type LlmProviderName,
} from '@ai/constants';
import type { ILlmProvider } from '@ai/interfaces';
import { ConfigurationErrorException } from '@ai/exceptions';
import type { ProviderConfigSettings } from '@config/ai-config.types';
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

  constructor(private readonly aiConfigService: AiConfigService) {
    const config = aiConfigService.provider;
    const runtime = this.buildRuntimeOptions(config);

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
    provider: ProviderConfigSettings,
  ): LlmRuntimeOptions {
    return {
      timeoutMs: provider.requestTimeoutMs,
      maxRetries: provider.retryMaxAttempts,
      retryDelayMs: provider.retryDelayMs,
    };
  }
}
