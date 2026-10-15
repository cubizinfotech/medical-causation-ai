import { Logger } from '@nestjs/common';
import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import {
  ProviderUnavailableException,
  RateLimitExceededException,
  type ProviderFailureKind,
} from '@ai/exceptions';
import { BaseLlmProvider } from './base/base-llm.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';
import { createGeminiClient } from '@ai/utils/gemini-client.util';
import {
  classifyGeminiError,
  type GeminiErrorInfo,
} from '@ai/utils/gemini-errors.util';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Overloaded (503) and dropped connections are common and cost nothing to retry once. */
const MIN_TRANSIENT_ATTEMPTS = 2;
const MAX_TRANSIENT_DELAY_MS = 5000;

const FAILURE_BY_KIND: Partial<
  Record<GeminiErrorInfo['kind'], ProviderFailureKind>
> = {
  auth: 'auth',
  permission: 'auth',
  not_found: 'not_found',
  invalid_request: 'invalid_request',
  timeout: 'timeout',
};

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
    const configuredAttempts = Math.max(1, this.runtime.maxRetries);

    for (let attempt = 1; ; attempt++) {
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
        // MAX_TOKENS means the answer was cut off; callers use this to
        // shorten the request instead of resending the same one.
        const finishReason =
          response.candidates?.[0]?.finishReason ??
          response.promptFeedback?.blockReason;

        return {
          content: response.text ?? '',
          model: response.modelVersion ?? model,
          provider: this.name,
          finishReason: finishReason ? String(finishReason) : undefined,
          usage: {
            promptTokens: usage?.promptTokenCount ?? 0,
            completionTokens: usage?.candidatesTokenCount ?? 0,
            totalTokens: usage?.totalTokenCount ?? 0,
          },
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        const info = classifyGeminiError(error);
        const attempts =
          info.kind === 'server' || info.kind === 'network'
            ? Math.max(configuredAttempts, MIN_TRANSIENT_ATTEMPTS)
            : configuredAttempts;

        if (info.retryable && attempt < attempts) {
          const delay =
            info.retryAfterMs ??
            (info.kind === 'rate_limit'
              ? this.runtime.retryDelayMs * attempt * 2
              : Math.min(
                  this.runtime.retryDelayMs * attempt,
                  MAX_TRANSIENT_DELAY_MS,
                ));
          this.logger.warn(
            `Gemini ${info.kind}${info.status ? ` (${info.status})` : ''} on attempt ${attempt}/${attempts}; retrying in ${delay}ms: ${info.detail}`,
          );
          await sleep(delay);
          continue;
        }

        this.logger.warn(
          `Gemini request failed: ${info.kind}${info.status ? ` (${info.status})` : ''}: ${info.detail}`,
        );
        throw this.toException(info, attempt);
      }
    }
  }

  private toException(info: GeminiErrorInfo, attempt: number): Error {
    if (info.kind === 'rate_limit' || info.kind === 'quota') {
      return new RateLimitExceededException(
        this.name,
        info.retryAfterMs ?? this.runtime.retryDelayMs * attempt * 2,
        info.kind === 'quota',
      );
    }
    return new ProviderUnavailableException(
      this.name,
      info.detail,
      FAILURE_BY_KIND[info.kind] ?? 'unavailable',
    );
  }
}
