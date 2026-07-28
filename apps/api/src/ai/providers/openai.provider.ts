import { DEFAULT_LLM_MODELS, LLM_PROVIDERS } from '@ai/constants';
import type { AIProviderSettings } from '@config/config.types';
import {
  OpenAiCompatibleLlmProvider,
  type LlmRuntimeOptions,
} from './base/openai-compatible-llm.provider';

export class OpenAiProvider extends OpenAiCompatibleLlmProvider {
  readonly name = LLM_PROVIDERS.OPENAI;
  readonly defaultModel = DEFAULT_LLM_MODELS[LLM_PROVIDERS.OPENAI];

  constructor(settings: AIProviderSettings, runtime: LlmRuntimeOptions) {
    super(settings, runtime);
  }
}
