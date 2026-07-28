/**
 * Frontend AI service types.
 * Mirrors backend AI types for type-safe client-server communication.
 */

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  promptTemplateId?: string;
  promptVariables?: Record<string, string>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage: AiTokenUsage;
  executionTimeMs: number;
}

export interface AiProviderStatus {
  name: string;
  available: boolean;
  defaultModel: string;
  active: boolean;
}

export interface AiEmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface AiEmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: string;
  dimensions: number;
  usage: AiTokenUsage;
  executionTimeMs: number;
}

export interface PromptTemplateInfo {
  id: string;
  name: string;
  category: string;
  version: string;
  variables: string[];
  description: string;
}
