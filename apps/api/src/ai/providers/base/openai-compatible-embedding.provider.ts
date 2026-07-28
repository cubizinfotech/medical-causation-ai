import { Logger } from '@nestjs/common';
import type { AIProviderSettings } from '@config/config.types';
import type { EmbeddingProviderName } from '@ai/constants';
import type { EmbeddingRequest, EmbeddingResponse } from '@ai/types';
import { ProviderUnavailableException } from '@ai/exceptions';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import { fetchOpenAiCompatibleEmbeddings } from '@ai/utils/embedding-http.util';

export interface EmbeddingRuntimeOptions {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  dimensions?: number;
}

/**
 * Base class for OpenAI-compatible embedding providers.
 */
export abstract class OpenAiCompatibleEmbeddingProvider extends BaseEmbeddingProvider {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    settings: AIProviderSettings,
    protected readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  abstract readonly name: EmbeddingProviderName;

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();

    const model = request.model ?? this.defaultModel;
    const texts = request.inputs.map((input) => input.text);
    const startTime = Date.now();

    const {
      embeddings,
      model: resolvedModel,
      usage,
    } = await fetchOpenAiCompatibleEmbeddings({
      baseUrl: this.settings.baseUrl,
      apiKey: this.settings.apiKey,
      model,
      inputs: texts,
      dimensions: request.dimensions ?? this.runtime.dimensions,
      timeoutMs: this.runtime.timeoutMs,
      maxRetries: this.runtime.maxRetries,
      retryDelayMs: this.runtime.retryDelayMs,
      providerName: this.name,
      organization: this.settings.organization,
      extraHeaders: this.getExtraHeaders(),
    });

    const results = request.inputs.map((input, index) => ({
      id: input.id,
      embedding: embeddings[index],
      model: resolvedModel,
      provider: this.name,
      dimensions: embeddings[index]?.length ?? this.defaultDimensions,
      usage,
      executionTimeMs: Date.now() - startTime,
    }));

    return {
      results,
      model: resolvedModel,
      provider: this.name,
      usage,
      executionTimeMs: Date.now() - startTime,
    };
  }

  protected getExtraHeaders(): Record<string, string> | undefined {
    return undefined;
  }
}

/**
 * Shared helper for JSON embedding APIs.
 */
export async function postJsonEmbeddings(options: {
  url: string;
  apiKey: string;
  body: unknown;
  provider: EmbeddingProviderName;
  timeoutMs: number;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(options.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function unavailable(
  provider: EmbeddingProviderName,
  message: string,
): never {
  throw new ProviderUnavailableException(provider, message);
}
