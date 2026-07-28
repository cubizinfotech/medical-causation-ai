import { Logger } from '@nestjs/common';
import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import { ProviderUnavailableException } from '@ai/exceptions';
import { BaseLlmProvider } from './base/base-llm.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';

export class AnthropicProvider extends BaseLlmProvider {
  readonly name = LLM_PROVIDERS.ANTHROPIC;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.ANTHROPIC];
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: LlmRuntimeOptions,
  ) {
    super(settings);
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    this.validateConfiguration();
    const startTime = Date.now();
    const model = request.model ?? this.defaultModel;

    const system =
      request.systemPrompt ??
      request.messages.find((m) => m.role === 'system')?.content;
    const messages = request.messages.filter((m) => m.role !== 'system');

    const response = await fetch(
      `${this.settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.2,
          system,
          messages: messages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
        signal: AbortSignal.timeout(this.runtime.timeoutMs),
      },
    );

    if (!response.ok) {
      throw new ProviderUnavailableException(this.name, await response.text());
    }

    const payload = (await response.json()) as {
      content?: Array<{ text?: string }>;
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      content: payload.content?.map((c) => c.text ?? '').join('') ?? '',
      model: payload.model ?? model,
      provider: this.name,
      usage: {
        promptTokens: payload.usage?.input_tokens ?? 0,
        completionTokens: payload.usage?.output_tokens ?? 0,
        totalTokens:
          (payload.usage?.input_tokens ?? 0) +
          (payload.usage?.output_tokens ?? 0),
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
