import {
  DEFAULT_EMBEDDING_MODELS,
  EMBEDDING_PROVIDERS,
  type EmbeddingProviderName,
} from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import type { EmbeddingRequest, EmbeddingResponse } from '@ai/types';
import { ProviderUnavailableException } from '@ai/exceptions';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import {
  type EmbeddingRuntimeOptions,
  postJsonEmbeddings,
  unavailable,
} from '../base/openai-compatible-embedding.provider';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.GEMINI;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.GEMINI];
  readonly defaultDimensions = 768;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();
    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const input of request.inputs) {
      let success = false;
      let lastError = 'Gemini embedding failed';

      for (let attempt = 1; attempt <= this.runtime.maxRetries; attempt++) {
        try {
          const url = `${this.settings.baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:embedContent?key=${this.settings.apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: input.text }] },
            }),
            signal: AbortSignal.timeout(this.runtime.timeoutMs),
          });

          if (!response.ok) {
            throw new Error(await response.text());
          }

          const payload = (await response.json()) as {
            embedding?: { values?: number[] };
          };

          embeddings.push(payload.embedding?.values ?? []);
          totalTokens += Math.ceil(input.text.length / 4);
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt < this.runtime.maxRetries) {
            await sleep(this.runtime.retryDelayMs * attempt);
          }
        }
      }

      if (!success) {
        unavailable(this.name, lastError);
      }
    }

    const usage = {
      promptTokens: totalTokens,
      completionTokens: 0,
      totalTokens,
    };

    return {
      results: request.inputs.map((input, index) => ({
        id: input.id,
        embedding: embeddings[index],
        model,
        provider: this.name,
        dimensions: embeddings[index]?.length ?? this.defaultDimensions,
        usage,
        executionTimeMs: Date.now() - startTime,
      })),
      model,
      provider: this.name,
      usage,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

async function embedWithOpenAiCompatibleApi(
  settings: AIProviderSettings,
  runtime: EmbeddingRuntimeOptions,
  request: EmbeddingRequest,
  provider: EmbeddingProviderName,
  defaultModel: string,
  defaultDimensions: number,
): Promise<EmbeddingResponse> {
  const model = request.model ?? defaultModel;
  const startTime = Date.now();
  const url = `${settings.baseUrl.replace(/\/$/, '')}/embeddings`;
  const response = await postJsonEmbeddings({
    url,
    apiKey: settings.apiKey,
    body: {
      model,
      input: request.inputs.map((input) => input.text),
    },
    provider,
    timeoutMs: runtime.timeoutMs,
  });

  if (!response.ok) {
    unavailable(provider, await response.text());
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
    usage?: { total_tokens?: number };
  };

  const embeddings = payload.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);

  const usage = {
    promptTokens: payload.usage?.total_tokens ?? 0,
    completionTokens: 0,
    totalTokens: payload.usage?.total_tokens ?? 0,
  };

  return {
    results: request.inputs.map((input, index) => ({
      id: input.id,
      embedding: embeddings[index],
      model,
      provider,
      dimensions: embeddings[index]?.length ?? defaultDimensions,
      usage,
      executionTimeMs: Date.now() - startTime,
    })),
    model,
    provider,
    usage,
    executionTimeMs: Date.now() - startTime,
  };
}

export class VoyageEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.VOYAGE;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.VOYAGE];
  readonly defaultDimensions = 1024;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();
    return embedWithOpenAiCompatibleApi(
      this.settings,
      this.runtime,
      request,
      this.name,
      this.defaultModel,
      this.defaultDimensions,
    );
  }
}

export class JinaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.JINA;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.JINA];
  readonly defaultDimensions = 1024;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();
    return embedWithOpenAiCompatibleApi(
      this.settings,
      this.runtime,
      request,
      this.name,
      this.defaultModel,
      this.defaultDimensions,
    );
  }
}

export class NomicEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.NOMIC;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.NOMIC];
  readonly defaultDimensions = 768;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();
    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();
    const url = `${this.settings.baseUrl.replace(/\/$/, '')}/embedding/text`;
    const embeddings: number[][] = [];

    for (const input of request.inputs) {
      const response = await postJsonEmbeddings({
        url,
        apiKey: this.settings.apiKey,
        body: { model, text: input.text },
        provider: this.name,
        timeoutMs: this.runtime.timeoutMs,
      });

      if (!response.ok) {
        unavailable(this.name, await response.text());
      }

      const payload = (await response.json()) as { embedding?: number[] };
      embeddings.push(payload.embedding ?? []);
    }

    const usage = {
      promptTokens: request.inputs.reduce(
        (sum, input) => sum + Math.ceil(input.text.length / 4),
        0,
      ),
      completionTokens: 0,
      totalTokens: 0,
    };
    usage.totalTokens = usage.promptTokens;

    return {
      results: request.inputs.map((input, index) => ({
        id: input.id,
        embedding: embeddings[index],
        model,
        provider: this.name,
        dimensions: embeddings[index]?.length ?? this.defaultDimensions,
        usage,
        executionTimeMs: Date.now() - startTime,
      })),
      model,
      provider: this.name,
      usage,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.OLLAMA;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.OLLAMA];
  readonly defaultDimensions = 768;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
  }

  override isAvailable(): boolean {
    return Boolean(this.settings.baseUrl);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateConfiguration();
    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();
    const url = `${this.settings.baseUrl.replace(/\/$/, '')}/api/embeddings`;
    const embeddings: number[][] = [];

    for (const input of request.inputs) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: input.text }),
        signal: AbortSignal.timeout(this.runtime.timeoutMs),
      });

      if (!response.ok) {
        unavailable(this.name, await response.text());
      }

      const payload = (await response.json()) as { embedding?: number[] };
      embeddings.push(payload.embedding ?? []);
    }

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    return {
      results: request.inputs.map((input, index) => ({
        id: input.id,
        embedding: embeddings[index],
        model,
        provider: this.name,
        dimensions: embeddings[index]?.length ?? this.defaultDimensions,
        usage,
        executionTimeMs: Date.now() - startTime,
      })),
      model,
      provider: this.name,
      usage,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export class GroqEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = EMBEDDING_PROVIDERS.GROQ;
  readonly defaultModel = DEFAULT_EMBEDDING_MODELS[EMBEDDING_PROVIDERS.GROQ];
  readonly defaultDimensions = 768;

  constructor(
    settings: AIProviderSettings,
    private readonly runtime: EmbeddingRuntimeOptions,
  ) {
    super(settings);
    void this.runtime;
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    void request;
    return Promise.reject(
      new ProviderUnavailableException(
        this.name,
        'Groq embeddings are not yet available — reserved for future integration',
      ),
    );
  }
}
