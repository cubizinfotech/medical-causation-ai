import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import {
  OpenAiCompatibleLlmProvider,
  type LlmRuntimeOptions,
} from './base/openai-compatible-llm.provider';

export class OpenRouterProvider extends OpenAiCompatibleLlmProvider {
  readonly name = LLM_PROVIDERS.OPENROUTER;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.OPENROUTER];

  constructor(settings: AIProviderSettings, runtime: LlmRuntimeOptions) {
    super(settings, runtime);
  }

  protected override getExtraHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://medical-causation-ai.local',
      'X-Title': 'Medical Causation AI',
    };
  }
}
