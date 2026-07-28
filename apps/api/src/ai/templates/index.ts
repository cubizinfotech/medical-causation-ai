/**
 * Re-exports prompt template metadata for external consumers.
 * Template files live in ../prompts/ and are loaded at runtime by PromptService.
 */
export {
  PROMPT_REGISTRY,
  findPromptTemplate,
} from '../prompts/prompt.registry';
export type { PromptTemplateMetadata } from '@ai/types';
