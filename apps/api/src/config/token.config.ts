import type { TokenConfigSettings } from './ai-config.types';

export const tokenConfig = (): TokenConfigSettings => ({
  maxPromptTokens: Number(process.env.AI_MAX_PROMPT_TOKENS ?? 128000),
  maxCompletionTokens: Number(process.env.AI_MAX_COMPLETION_TOKENS ?? 4096),
  maxTotalTokens: Number(process.env.AI_MAX_TOTAL_TOKENS ?? 131072),
  costPer1kPromptTokensUsd: Number(
    process.env.AI_COST_PER_1K_PROMPT_TOKENS_USD ?? 0,
  ),
  costPer1kCompletionTokensUsd: Number(
    process.env.AI_COST_PER_1K_COMPLETION_TOKENS_USD ?? 0,
  ),
});
