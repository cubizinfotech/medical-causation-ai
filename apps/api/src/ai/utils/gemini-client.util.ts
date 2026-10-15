import { GoogleGenAI } from '@google/genai';

export function resolveGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
}

/**
 * Chat model ids are not valid for embedContent. A copied GEMINI_LLM_MODEL
 * would otherwise fail the request and surface as "Gemini is unavailable".
 */
export function resolveGeminiEmbeddingModel(
  configured: string | undefined,
  fallback: string,
): { model: string; replaced: boolean } {
  const model = configured?.trim() ?? '';
  if (!model) return { model: fallback, replaced: false };
  if (/embedding/i.test(model)) return { model, replaced: false };
  return { model: fallback, replaced: true };
}

export function createGeminiClient(apiKey?: string): GoogleGenAI {
  const resolvedKey = apiKey ?? resolveGeminiApiKey();
  const projectId = process.env.GEMINI_PROJECT_ID;

  if (process.env.GEMINI_USE_ENTERPRISE === 'true' && projectId) {
    return new GoogleGenAI({
      apiKey: resolvedKey,
      enterprise: true,
      project: projectId,
    });
  }

  return new GoogleGenAI({ apiKey: resolvedKey });
}
