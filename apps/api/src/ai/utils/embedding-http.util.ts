import { Logger } from '@nestjs/common';
import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import type { TokenUsage } from '@ai/types';

export interface OpenAiCompatibleEmbeddingOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  inputs: string[];
  dimensions?: number;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  providerName: string;
  organization?: string;
  extraHeaders?: Record<string, string>;
}

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

const logger = new Logger('EmbeddingHttpClient');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared HTTP client for OpenAI-compatible embedding APIs
 * (OpenAI, OpenRouter, Groq when available).
 */
export async function fetchOpenAiCompatibleEmbeddings(
  options: OpenAiCompatibleEmbeddingOptions,
): Promise<{ embeddings: number[][]; model: string; usage: TokenUsage }> {
  if (!options.apiKey && options.providerName !== 'ollama') {
    throw new ProviderUnavailableException(
      options.providerName,
      'API key is not configured',
    );
  }

  // const url = `${options.baseUrl.replace(/\/$/, '')}/embeddings`;
  const url = `${options.baseUrl.replace(/\/$/, '')}/rerank`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: options.model,
        input: options.inputs,
      };

      if (options.dimensions) {
        body.dimensions = options.dimensions;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.extraHeaders,
      };

      if (options.apiKey) {
        headers.Authorization = `Bearer ${options.apiKey}`;
      }

      if (options.organization) {
        headers['OpenAI-Organization'] = options.organization;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 0);
        throw new RateLimitExceededException(
          options.providerName,
          retryAfter > 0 ? retryAfter * 1000 : options.retryDelayMs * attempt,
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding request failed (${response.status}): ${errorText}`,
        );
      }

      const payload = (await response.json()) as OpenAiEmbeddingResponse;
      const embeddings = payload.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      const usage: TokenUsage = {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      };

      logger.debug(
        `Embeddings generated via ${options.providerName} URL=${url} model=${payload.model} count=${embeddings.length}`,
      );

      return { embeddings, model: payload.model, usage };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        error instanceof RateLimitExceededException &&
        attempt < options.maxRetries
      ) {
        const delay = error.message.includes('retry after')
          ? options.retryDelayMs * attempt * 2
          : options.retryDelayMs * attempt;
        logger.warn(
          `Rate limit for ${options.providerName}, retrying in ${delay}ms (attempt ${attempt}/${options.maxRetries})`,
        );
        await sleep(delay);
        continue;
      }

      if (attempt < options.maxRetries) {
        const delay = options.retryDelayMs * attempt;
        logger.warn(
          `Embedding request failed for ${options.providerName}, URL=${url} retrying in ${delay}ms (attempt ${attempt}/${options.maxRetries}): ${lastError.message}`,
        );
        await sleep(delay);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderUnavailableException(
    options.providerName,
    lastError?.message ?? 'Unknown embedding error',
  );
}
