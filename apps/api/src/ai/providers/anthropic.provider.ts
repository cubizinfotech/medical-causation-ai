import { Logger } from '@nestjs/common';
import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import { BaseLlmProvider } from './base/base-llm.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';

const JSON_ONLY_INSTRUCTION =
  'Respond with a single valid JSON object only. Do not include markdown fences, explanations, or reasoning text outside the JSON object.';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const wantsJson = request.metadata?.responseFormat === 'json';

    const systemFromMessages =
      request.systemPrompt ??
      request.messages.find((m) => m.role === 'system')?.content;
    const system = wantsJson
      ? `${systemFromMessages ?? ''}\n\n${JSON_ONLY_INSTRUCTION}`.trim()
      : systemFromMessages;

    const messages = request.messages.filter((m) => m.role !== 'system');

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.runtime.maxRetries; attempt++) {
      try {
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

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? 0);
          throw new RateLimitExceededException(
            this.name,
            retryAfter > 0
              ? retryAfter * 1000
              : this.runtime.retryDelayMs * attempt,
          );
        }

        if (!response.ok) {
          throw new ProviderUnavailableException(
            this.name,
            await response.text(),
          );
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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.runtime.maxRetries) {
          const delay =
            error instanceof RateLimitExceededException
              ? (error.retryAfterMs ?? this.runtime.retryDelayMs * attempt * 2)
              : this.runtime.retryDelayMs * attempt;

          this.logger.warn(
            `Anthropic request failed, retrying in ${delay}ms (attempt ${attempt}/${this.runtime.maxRetries}): ${lastError.message}`,
          );
          await sleep(delay);
        }
      }
    }

    throw new ProviderUnavailableException(
      this.name,
      lastError?.message ?? 'Unknown Anthropic error',
    );
  }
}
