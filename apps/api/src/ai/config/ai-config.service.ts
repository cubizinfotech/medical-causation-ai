import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ProviderConfigSettings,
  EmbeddingConfigSettings,
  PromptConfigSettings,
  TokenConfigSettings,
} from '@config/ai-config.types';
import type { LlmProviderName } from '@ai/constants';
import type { EmbeddingProviderName } from '@ai/constants';

/**
 * Typed accessor for AI-related configuration.
 * All AI modules must use this service — never access process.env directly.
 */
@Injectable()
export class AiConfigService {
  constructor(private readonly configService: ConfigService) {}

  get provider(): ProviderConfigSettings {
    return this.configService.get<ProviderConfigSettings>('ai')!;
  }

  get embedding(): EmbeddingConfigSettings {
    return this.configService.get<EmbeddingConfigSettings>('embedding')!;
  }

  get prompt(): PromptConfigSettings {
    return this.configService.get<PromptConfigSettings>('prompt')!;
  }

  get token(): TokenConfigSettings {
    return this.configService.get<TokenConfigSettings>('token')!;
  }

  get activeLlmProvider(): LlmProviderName {
    return this.provider.activeProvider as LlmProviderName;
  }

  get activeEmbeddingProvider(): EmbeddingProviderName {
    return this.embedding.provider as EmbeddingProviderName;
  }

  get chatModel(): string {
    return this.provider.chatModel;
  }

  get embeddingModel(): string {
    return this.embedding.model;
  }

  get temperature(): number {
    return this.provider.temperature;
  }

  get maxTokens(): number {
    return this.provider.maxTokens;
  }
}
