import { Injectable, Logger } from '@nestjs/common';
import { AiConfigService } from '@ai/config';
import {
  ProviderUnavailableException,
  RateLimitExceededException,
  TokenLimitExceededException,
} from '@ai/exceptions';
import { LlmProviderFactory, EmbeddingProviderFactory } from '@ai/providers';
import type { ILlmProvider, IEmbeddingProvider } from '@ai/interfaces';
import type {
  AiCompletionOptions,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@ai/types';
import { estimateTokenCount } from '@ai/utils';
import { PromptService } from './prompt.service';

/**
 * Single entry point for all AI operations.
 * Future modules (RAG, reports, causation engine) must use this service
 * — never call LLM or embedding providers directly.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly aiConfigService: AiConfigService,
    private readonly llmProviderFactory: LlmProviderFactory,
    private readonly embeddingProviderFactory: EmbeddingProviderFactory,
    private readonly promptService: PromptService,
  ) {}

  /**
   * Returns the currently active LLM provider.
   */
  getActiveLlmProvider(): ILlmProvider {
    return this.llmProviderFactory.getActiveProvider();
  }

  /**
   * Returns the currently active embedding provider.
   */
  getActiveEmbeddingProvider(): IEmbeddingProvider {
    return this.embeddingProviderFactory.getActiveProvider();
  }

  /**
   * Returns metadata about all registered LLM providers and their availability.
   */
  getLlmProviderStatus(): Array<{
    name: string;
    available: boolean;
    defaultModel: string;
    active: boolean;
  }> {
    const activeName = this.aiConfigService.activeLlmProvider;
    return this.llmProviderFactory.getAllProviders().map((provider) => ({
      name: provider.name,
      available: provider.isAvailable(),
      defaultModel: provider.defaultModel,
      active: provider.name === activeName,
    }));
  }

  /**
   * Execute an LLM completion request through the active provider. When it
   * refuses the call (rate limit, no quota, bad key, outage) and
   * AI_FALLBACK_PROVIDER is set, the same request goes to that provider.
   */
  async complete(options: AiCompletionOptions): Promise<LlmCompletionResponse> {
    const messages = await this.buildMessages(options);
    this.validateTokenLimits(messages);

    const primary = this.llmProviderFactory.getActiveProvider();
    try {
      return await this.completeWith(primary, messages, options, options.model);
    } catch (error) {
      const fallback = this.fallbackFor(error);
      if (!fallback) throw error;
      this.logger.warn(
        `${primary.name} refused the request (${error instanceof Error ? error.message : String(error)}); using fallback provider ${fallback.name}`,
      );
      // options.model names a model of the primary provider, so the
      // fallback uses its own configured model.
      return this.completeWith(fallback, messages, options);
    }
  }

  private async completeWith(
    provider: ILlmProvider,
    messages: LlmMessage[],
    options: AiCompletionOptions,
    requestedModel?: string,
  ): Promise<LlmCompletionResponse> {
    const model = this.llmProviderFactory.resolveModel(
      provider,
      requestedModel,
    );
    const request: LlmCompletionRequest = {
      messages,
      model,
      temperature: options.temperature ?? this.aiConfigService.temperature,
      maxTokens: options.maxTokens ?? this.aiConfigService.maxTokens,
      metadata: options.metadata,
    };

    this.logger.debug(
      `LLM completion via ${provider.name} model=${model} messages=${messages.length}`,
    );

    const startTime = Date.now();
    const response = await provider.complete(request);

    return {
      ...response,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /** The fallback provider, when this error is one it can help with. */
  private fallbackFor(error: unknown): ILlmProvider | null {
    const refused =
      error instanceof RateLimitExceededException ||
      error instanceof ProviderUnavailableException;
    const name = this.aiConfigService.fallbackLlmProvider;
    if (!refused || !name) return null;
    try {
      const provider = this.llmProviderFactory.getProvider(name);
      return provider.isAvailable() ? provider : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate embeddings through the active embedding provider.
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const provider = this.embeddingProviderFactory.getActiveProvider();
    const model = this.embeddingProviderFactory.resolveModel(
      provider,
      request.model,
    );

    this.logger.debug(
      `Embedding request via ${provider.name} model=${model} inputs=${request.inputs.length}`,
    );

    const startTime = Date.now();
    const response = await provider.embed({ ...request, model });

    return {
      ...response,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Load a prompt template by ID with optional variable substitution.
   */
  async loadPrompt(templateId: string, variables?: Record<string, string>) {
    return this.promptService.load({ templateId, variables });
  }

  private async buildMessages(
    options: AiCompletionOptions,
  ): Promise<LlmMessage[]> {
    const messages: LlmMessage[] = [...options.messages];

    if (options.promptTemplateId) {
      const loaded = await this.promptService.load({
        templateId: options.promptTemplateId,
        variables: options.promptVariables,
      });
      messages.unshift({ role: 'user', content: loaded.content });
    } else if (options.promptTemplate) {
      const rendered = this.promptService.render(
        options.promptTemplate,
        options.promptVariables,
      );
      messages.unshift({ role: 'user', content: rendered });
    }

    return messages;
  }

  private validateTokenLimits(messages: LlmMessage[]): void {
    const tokenConfig = this.aiConfigService.token;
    const totalText = messages.map((m) => m.content).join(' ');
    const estimated = estimateTokenCount(totalText);

    if (estimated > tokenConfig.maxPromptTokens) {
      throw new TokenLimitExceededException(
        'prompt',
        tokenConfig.maxPromptTokens,
        estimated,
      );
    }
  }
}
