import { Logger } from '@nestjs/common';
import type { AIProviderSettings } from '@config/config.types';
import type { LlmProviderName } from '@ai/constants';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import { BaseLlmProvider } from '../base/base-llm.provider';
import { fetchOpenAiCompatibleChat } from '@ai/utils/llm-http.util';

export interface LlmRuntimeOptions {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export abstract class OpenAiCompatibleLlmProvider extends BaseLlmProvider {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    settings: AIProviderSettings,
    protected readonly runtime: LlmRuntimeOptions,
  ) {
    super(settings);
  }

  abstract readonly name: LlmProviderName;

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    this.validateConfiguration();

    const messages = [...request.messages];
    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const startTime = Date.now();
    const response = await fetchOpenAiCompatibleChat({
      baseUrl: this.settings.baseUrl,
      apiKey: this.settings.apiKey,
      model: request.model ?? this.defaultModel,
      messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      timeoutMs: this.runtime.timeoutMs,
      maxRetries: this.runtime.maxRetries,
      retryDelayMs: this.runtime.retryDelayMs,
      providerName: this.name,
      organization: this.settings.organization,
      extraHeaders: this.getExtraHeaders(),
      responseFormat:
        request.metadata?.responseFormat === 'json'
          ? { type: 'json_object' }
          : undefined,
    });

    return {
      ...response,
      executionTimeMs: Date.now() - startTime,
    };
  }

  protected getExtraHeaders(): Record<string, string> | undefined {
    return undefined;
  }
}
