import { GoogleGenAI } from '@google/genai';

export function resolveGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
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
