import { GoogleGenAI } from '@google/genai';

/** Google AI Studio keys start with AIza; Gemini keys start with AQ. */
const GEMINI_KEY_SHAPE = /^(AIza|AQ\.)/;

let warnedUnusableGeminiKey = false;

/**
 * Drop a truncated or pasted-wrong key so Gemini is treated as unconfigured
 * instead of authenticating with a value that cannot succeed.
 */
export function usableGeminiApiKey(
  value: string | undefined,
): string | undefined {
  const key = value?.trim();
  if (!key) return undefined;
  if (GEMINI_KEY_SHAPE.test(key) && key.length >= 32) return key;
  if (!warnedUnusableGeminiKey) {
    warnedUnusableGeminiKey = true;
    console.warn(
      'GEMINI_API_KEY does not look like a full Google AI key (expected AIza… or AQ.…). Gemini chat and web search will not use it.',
    );
  }
  return undefined;
}

export function resolveGeminiApiKey(): string {
  return (
    usableGeminiApiKey(process.env.GEMINI_API_KEY) ??
    usableGeminiApiKey(process.env.GOOGLE_API_KEY) ??
    ''
  );
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
