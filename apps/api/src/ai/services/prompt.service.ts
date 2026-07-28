import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AiConfigService } from '@ai/config';
import { InvalidPromptException } from '@ai/exceptions';
import { findPromptTemplate, PROMPT_REGISTRY } from '@ai/prompts';
import type {
  LoadedPrompt,
  PromptLoadOptions,
  PromptTemplateMetadata,
} from '@ai/types';
import { renderPromptTemplate } from '@ai/utils';

interface CachedPrompt {
  content: string;
  loadedAt: number;
}

/**
 * Manages loading, caching, and rendering of prompt templates.
 * Templates are stored as files in the prompts/ directory.
 */
@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);
  private readonly cache = new Map<string, CachedPrompt>();

  constructor(private readonly aiConfigService: AiConfigService) {}

  /**
   * Returns metadata for all registered prompt templates.
   */
  listTemplates(): PromptTemplateMetadata[] {
    return PROMPT_REGISTRY;
  }

  /**
   * Load and optionally render a prompt template.
   */
  async load(options: PromptLoadOptions): Promise<LoadedPrompt> {
    const metadata = findPromptTemplate(options.templateId);

    if (!metadata) {
      throw new InvalidPromptException(
        `Prompt template "${options.templateId}" not found in registry`,
      );
    }

    const rawContent = await this.loadTemplateFile(metadata.filename);
    const variables = options.variables ?? {};
    const content = renderPromptTemplate(rawContent, variables);

    return {
      metadata,
      rawContent,
      content,
      appliedVariables: variables,
    };
  }

  /**
   * Render an inline template string with variables.
   */
  render(template: string, variables: Record<string, string> = {}): string {
    return renderPromptTemplate(template, variables);
  }

  private async loadTemplateFile(filename: string): Promise<string> {
    const promptConfig = this.aiConfigService.prompt;

    if (promptConfig.cacheEnabled) {
      const cached = this.cache.get(filename);
      if (
        cached &&
        !this.isCacheExpired(cached, promptConfig.cacheTtlSeconds)
      ) {
        return cached.content;
      }
    }

    const filePath = join(promptConfig.templatesDir, filename);

    try {
      const content = await readFile(filePath, 'utf-8');

      if (promptConfig.cacheEnabled) {
        this.cache.set(filename, { content, loadedAt: Date.now() });
      }

      return content;
    } catch {
      throw new InvalidPromptException(
        `Failed to load prompt template file: ${filename}`,
      );
    }
  }

  private isCacheExpired(cached: CachedPrompt, ttlSeconds: number): boolean {
    if (ttlSeconds === 0) return false;
    return Date.now() - cached.loadedAt > ttlSeconds * 1000;
  }

  /** Clear the in-memory template cache. */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Prompt template cache cleared');
  }
}
