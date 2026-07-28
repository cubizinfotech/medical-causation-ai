import { Logger } from '@nestjs/common';
import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@ai/types';
import { ProviderUnavailableException } from '@ai/exceptions';
import { BaseLlmProvider } from './base/base-llm.provider';
import type { LlmRuntimeOptions } from './base/openai-compatible-llm.provider';

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

    const prompt = [
      request.systemPrompt,
      ...request.messages.map((m) => `${m.role}: ${m.content}`),
    ]
      .filter(Boolean)
      .join('\n\n');

    const url = `${this.settings.baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${this.settings.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 4096,
          responseMimeType:
            request.metadata?.responseFormat === 'json'
              ? 'application/json'
              : undefined,
        },
      }),
      signal: AbortSignal.timeout(this.runtime.timeoutMs),
    });

    if (!response.ok) {
      throw new ProviderUnavailableException(this.name, await response.text());
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const content =
      payload.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? '';

    return {
      content,
      model,
      provider: this.name,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens:
          (payload.usageMetadata?.promptTokenCount ?? 0) +
          (payload.usageMetadata?.candidatesTokenCount ?? 0),
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
