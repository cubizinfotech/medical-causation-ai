import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AnthropicProviderSettings } from '@config/config.types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import {
  InvalidModelException,
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import { BaseLlmProvider } from './base/base-llm.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';

const JSON_ONLY_INSTRUCTION =
  'Respond with a single valid JSON object only. Do not include markdown fences, explanations, or reasoning text outside the JSON object.';

/**
 * What each Claude model family accepts. Matched on the model ID prefix so
 * ANTHROPIC_LLM_MODEL can name any current or older model.
 */
// Adaptive thinking and output_config.effort: Opus 4.6+, Sonnet 4.6+, and the 5.x family.
const ADAPTIVE_THINKING_MODELS =
  /^claude-(opus-4-[6-9]|opus-5|sonnet-4-6|sonnet-5|fable|mythos)/;
// temperature is rejected (400) from Opus 4.7 and Sonnet 5 onward.
const NO_SAMPLING_MODELS =
  /^claude-(opus-4-[7-9]|opus-5|sonnet-5|fable|mythos)/;
// Server-side refusal fallback, "default" form (Claude API only).
const SERVER_FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5-1)/;
const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Claude through the official Anthropic SDK. */
export class AnthropicProvider extends BaseLlmProvider {
  readonly name = LLM_PROVIDERS.ANTHROPIC;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.ANTHROPIC];
  private readonly logger = new Logger(AnthropicProvider.name);
  private client?: Anthropic;

  constructor(
    protected readonly settings: AnthropicProviderSettings,
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
    const adaptive = ADAPTIVE_THINKING_MODELS.test(model);
    const useFallback =
      SERVER_FALLBACK_MODELS.test(model) && this.isClaudeApi();

    const systemFromMessages =
      request.systemPrompt ??
      request.messages.find((m) => m.role === 'system')?.content;
    const system =
      request.metadata?.responseFormat === 'json'
        ? `${systemFromMessages ?? ''}\n\n${JSON_ONLY_INSTRUCTION}`.trim()
        : systemFromMessages;

    // Thinking counts toward max_tokens, so a limit sized for other providers
    // (AI_MAX_TOKENS) would cut Claude's answer off. Only generated tokens
    // are billed, so a higher ceiling does not raise cost on its own.
    const maxTokens = adaptive
      ? Math.max(request.maxTokens ?? 0, this.settings.minMaxTokens)
      : (request.maxTokens ?? 4096);

    let message: Anthropic.Beta.Messages.BetaMessage;
    try {
      // Streaming avoids HTTP timeouts on long thinking turns.
      message = await this.getClient()
        .beta.messages.stream({
          model,
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages: request.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })),
          ...(adaptive
            ? {
                thinking: { type: 'adaptive' },
                output_config: { effort: this.settings.effort },
              }
            : {}),
          ...(NO_SAMPLING_MODELS.test(model)
            ? {}
            : { temperature: request.temperature ?? 0.2 }),
          ...(useFallback
            ? { betas: [SERVER_FALLBACK_BETA], fallbacks: 'default' }
            : {}),
        })
        .finalMessage();
    } catch (error) {
      throw this.toAiException(error, model);
    }

    // A classifier or model decline returns HTTP 200; any partial text is not
    // a usable answer. With fallbacks on, this means every model declined.
    if (message.stop_reason === 'refusal') {
      const category = message.stop_details?.category;
      throw new ProviderUnavailableException(
        this.name,
        `Claude declined this request${category ? ` (category: ${category})` : ''}.`,
      );
    }
    if (
      message.stop_reason === 'max_tokens' ||
      message.stop_reason === 'model_context_window_exceeded'
    ) {
      throw new ProviderUnavailableException(
        this.name,
        `Claude stopped before finishing (${message.stop_reason}, max_tokens=${maxTokens}). Raise ANTHROPIC_MAX_TOKENS.`,
      );
    }

    if (message.model !== model) {
      this.logger.warn(`Request for ${model} was served by ${message.model}`);
    }

    const promptTokens =
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0);

    return {
      content: message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join(''),
      model: message.model,
      provider: this.name,
      finishReason: message.stop_reason ?? undefined,
      usage: {
        promptTokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: promptTokens + message.usage.output_tokens,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private getClient(): Anthropic {
    this.client ??= new Anthropic({
      apiKey: this.settings.apiKey,
      baseURL: this.settings.baseUrl,
      timeout: this.runtime.timeoutMs,
      // The SDK retries 408/409/429/5xx and connection errors with backoff
      // and honors retry-after. AI_RETRY_MAX_ATTEMPTS counts the first try.
      maxRetries: Math.max(0, this.runtime.maxRetries - 1),
      ...(this.settings.workspaceId
        ? {
            defaultHeaders: {
              'anthropic-workspace-id': this.settings.workspaceId,
            },
          }
        : {}),
    });
    return this.client;
  }

  private isClaudeApi(): boolean {
    try {
      return new URL(this.settings.baseUrl).hostname === 'api.anthropic.com';
    } catch {
      return false;
    }
  }

  private toAiException(error: unknown, model: string): Error {
    if (error instanceof Anthropic.RateLimitError) {
      const retryAfter = Number(error.headers?.get('retry-after') ?? 0);
      return new RateLimitExceededException(
        this.name,
        retryAfter > 0 ? retryAfter * 1000 : undefined,
      );
    }
    if (error instanceof Anthropic.NotFoundError) {
      return new InvalidModelException(model, this.name);
    }
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      return new ProviderUnavailableException(
        this.name,
        'ANTHROPIC_API_KEY was rejected. Check the key in .env.',
      );
    }
    // The SDK message already starts with the HTTP status.
    if (error instanceof Anthropic.APIError) {
      return new ProviderUnavailableException(this.name, error.message);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
