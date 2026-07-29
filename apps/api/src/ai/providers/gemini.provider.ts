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
import { createGeminiClient } from '@ai/utils/gemini-client.util';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiProvider extends BaseLlmProvider {
  readonly name = LLM_PROVIDERS.GEMINI;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.GEMINI];
  private readonly logger = new Logger(GeminiProvider.name);

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

    const systemInstruction =
      request.systemPrompt ??
      request.messages.find((message) => message.role === 'system')?.content;

    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const ai = createGeminiClient(this.settings.apiKey);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.runtime.maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: request.temperature ?? 0.2,
            maxOutputTokens: request.maxTokens ?? 4096,
            responseMimeType: wantsJson ? 'application/json' : undefined,
            abortSignal: AbortSignal.timeout(this.runtime.timeoutMs),
          },
        });

        const usage = response.usageMetadata;

        return {
          content: response.text ?? '',
          model: response.modelVersion ?? model,
          provider: this.name,
          usage: {
            promptTokens: usage?.promptTokenCount ?? 0,
            completionTokens: usage?.candidatesTokenCount ?? 0,
            totalTokens: usage?.totalTokenCount ?? 0,
          },
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message.toLowerCase();
        const isRateLimit =
          message.includes('429') || message.includes('rate limit');

        if (attempt < this.runtime.maxRetries) {
          const delay = isRateLimit
            ? this.runtime.retryDelayMs * attempt * 2
            : this.runtime.retryDelayMs * attempt;

          this.logger.warn(
            `Gemini request failed, retrying in ${delay}ms (attempt ${attempt}/${this.runtime.maxRetries}): ${lastError.message}`,
          );
          await sleep(delay);
          continue;
        }

        if (isRateLimit) {
          throw new RateLimitExceededException(
            this.name,
            this.runtime.retryDelayMs * attempt * 2,
          );
        }
      }
    }

    throw new ProviderUnavailableException(
      this.name,
      lastError?.message ?? 'Unknown Gemini error',
    );
  }
}
