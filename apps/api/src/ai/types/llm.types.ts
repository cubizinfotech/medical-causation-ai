import type { LlmProviderName } from '@ai/constants';

/**
 * Role of a message in an LLM conversation.
 */
export type LlmMessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in an LLM conversation.
 */
export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

/**
 * Request payload for an LLM completion.
 */
export interface LlmCompletionRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, string>;
}

/**
 * Response from an LLM completion.
 */
export interface LlmCompletionResponse {
  content: string;
  model: string;
  provider: LlmProviderName;
  finishReason?: string;
  usage: import('./token-usage.types').TokenUsage;
  executionTimeMs: number;
}

/**
 * Options passed to AiService for a completion request.
 */
export interface AiCompletionOptions {
  messages: LlmMessage[];
  /** Inline template string with {{variable}} placeholders */
  promptTemplate?: string;
  /** Registry template ID (e.g. "medical/causation-analysis") */
  promptTemplateId?: string;
  promptVariables?: Record<string, string>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
}
