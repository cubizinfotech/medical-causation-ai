import { Injectable, Logger } from '@nestjs/common';
import { AiConfigService } from '@ai/config';
import { TokenLimitExceededException } from '@ai/exceptions';
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
   * Execute an LLM completion request through the active provider.
   */
  async complete(options: AiCompletionOptions): Promise<LlmCompletionResponse> {
    const provider = this.llmProviderFactory.getActiveProvider();
    const model = this.llmProviderFactory.resolveModel(provider, options.model);

    const messages = await this.buildMessages(options);

    this.validateTokenLimits(messages);

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
