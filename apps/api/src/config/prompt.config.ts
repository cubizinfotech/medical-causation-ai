import type { PromptConfigSettings } from './ai-config.types';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * The shared prompt templates. The working-directory path (as PM2 runs the
 * API) comes first; the path next to this file covers a process started
 * from another directory, which otherwise lost the EWI CV and analysis
 * prompts.
 */
function resolveTemplatesDir(): string {
  if (process.env.PROMPT_TEMPLATES_DIR) return process.env.PROMPT_TEMPLATES_DIR;
  const fromCwd =
    process.env.NODE_ENV === 'production'
      ? join(process.cwd(), 'dist', 'ai', 'prompts')
      : join(process.cwd(), 'src', 'ai', 'prompts');
  const candidates = [
    fromCwd,
    // dist/src/config -> dist/ai/prompts (nest build copies the assets there)
    resolve(__dirname, '..', '..', 'ai', 'prompts'),
    // src/config -> src/ai/prompts (ts-node)
    resolve(__dirname, '..', 'ai', 'prompts'),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? fromCwd;
}

export const promptConfig = (): PromptConfigSettings => ({
  templatesDir: resolveTemplatesDir(),
  defaultVersion: process.env.PROMPT_DEFAULT_VERSION ?? '1.0.0',
  cacheEnabled: process.env.PROMPT_CACHE_ENABLED !== 'false',
  cacheTtlSeconds: Number(process.env.PROMPT_CACHE_TTL_SECONDS ?? 3600),
});
