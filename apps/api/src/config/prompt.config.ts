import type { PromptConfigSettings } from './ai-config.types';
import { join } from 'path';

export const promptConfig = (): PromptConfigSettings => ({
  templatesDir:
    process.env.PROMPT_TEMPLATES_DIR ??
    (process.env.NODE_ENV === 'production'
      ? join(process.cwd(), 'dist', 'ai', 'prompts')
      : join(process.cwd(), 'src', 'ai', 'prompts')),
  defaultVersion: process.env.PROMPT_DEFAULT_VERSION ?? '1.0.0',
  cacheEnabled: process.env.PROMPT_CACHE_ENABLED !== 'false',
  cacheTtlSeconds: Number(process.env.PROMPT_CACHE_TTL_SECONDS ?? 3600),
});
