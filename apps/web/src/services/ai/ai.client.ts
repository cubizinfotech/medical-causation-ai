import { apiUrl } from "@/lib/config";
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProviderStatus,
  PromptTemplateInfo,
} from "./types";

/**
 * Frontend AI client service.
 *
 * All AI operations must go through this client — never call LLM providers directly.
 * API integration will be wired in a future phase when backend endpoints are available.
 */
export class AiClient {
  private readonly basePath = "/ai";

  /**
   * Execute an LLM completion request via the backend AI service.
   * @future POST /ai/complete
   */
  async complete(
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    void request;
    void apiUrl(`${this.basePath}/complete`);
    throw new Error(
      "AI completion API is not yet implemented. Use the backend AiService directly in future phases.",
    );
  }

  /**
   * Generate text embeddings via the backend embedding service.
   * @future POST /ai/embed
   */
  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    void request;
    void apiUrl(`${this.basePath}/embed`);
    throw new Error(
      "AI embedding API is not yet implemented.",
    );
  }

  /**
   * Get the status of all configured LLM providers.
   * @future GET /ai/providers
   */
  async getProviderStatus(): Promise<AiProviderStatus[]> {
    void apiUrl(`${this.basePath}/providers`);
    throw new Error(
      "AI provider status API is not yet implemented.",
    );
  }

  /**
   * List available prompt templates.
   * @future GET /ai/prompts
   */
  async listPromptTemplates(): Promise<PromptTemplateInfo[]> {
    void apiUrl(`${this.basePath}/prompts`);
    throw new Error(
      "Prompt template API is not yet implemented.",
    );
  }

  /**
   * Load and preview a rendered prompt template.
   * @future POST /ai/prompts/render
   */
  async renderPrompt(
    templateId: string,
    variables?: Record<string, string>,
  ): Promise<string> {
    void templateId;
    void variables;
    void apiUrl(`${this.basePath}/prompts/render`);
    throw new Error(
      "Prompt render API is not yet implemented.",
    );
  }
}

/** Singleton AI client instance for use across the frontend. */
export const aiClient = new AiClient();
