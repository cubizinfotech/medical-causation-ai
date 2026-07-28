import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import {
  OpenAiCompatibleLlmProvider,
  type LlmRuntimeOptions,
} from './base/openai-compatible-llm.provider';

export class GroqProvider extends OpenAiCompatibleLlmProvider {
  readonly name = LLM_PROVIDERS.GROQ;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.GROQ];

  constructor(settings: AIProviderSettings, runtime: LlmRuntimeOptions) {
    super(settings, runtime);
  }
}
