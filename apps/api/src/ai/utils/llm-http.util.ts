import { Logger } from '@nestjs/common';
import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import type { LlmMessage, LlmCompletionResponse } from '@ai/types';
import type { LlmProviderName } from '@ai/constants';
import type { TokenUsage } from '@ai/types';

export interface OpenAiCompatibleChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  providerName: LlmProviderName;
  organization?: string;
  extraHeaders?: Record<string, string>;
  responseFormat?: { type: 'json_object' };
}

interface OpenAiChatResponse {
  choices: Array<{
    message: { content: string };
    finish_reason?: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const logger = new Logger('LlmHttpClient');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchOpenAiCompatibleChat(
  options: OpenAiCompatibleChatOptions,
): Promise<Omit<LlmCompletionResponse, 'executionTimeMs'>> {
  if (!options.apiKey) {
    throw new ProviderUnavailableException(
      options.providerName,
      'API key is not configured',
    );
  }

  // const url = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const url = `${options.baseUrl.replace(/\/$/, '')}/rerank`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
      };

      if (options.maxTokens) {
        body.max_tokens = options.maxTokens;
      }

      if (options.responseFormat) {
        body.response_format = options.responseFormat;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        ...options.extraHeaders,
      };

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
        throw new RateLimitExceededException(
          options.providerName,
          options.retryDelayMs * attempt,
        );
      }

      if (!response.ok) {
        throw new Error(
          `Chat request failed (${response.status}): ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as OpenAiChatResponse;
      const content = payload.choices[0]?.message?.content ?? '';
      const usage: TokenUsage = {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      };

      logger.debug(
        `Chat completion via ${options.providerName} model=${payload.model}`,
      );

      return {
        content,
        model: payload.model,
        provider: options.providerName,
        finishReason: payload.choices[0]?.finish_reason,
        usage,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.maxRetries) {
        const delay = options.retryDelayMs * attempt;
        logger.warn(
          `LLM request failed for ${options.providerName}, retrying in ${delay}ms: ${lastError.message}`,
        );
        await sleep(delay);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderUnavailableException(
    options.providerName,
    lastError?.message ?? 'Unknown LLM error',
  );
}
