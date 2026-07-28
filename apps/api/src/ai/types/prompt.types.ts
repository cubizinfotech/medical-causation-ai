/**
 * Category of a prompt template.
 */
export type PromptCategory = 'system' | 'medical' | 'reports' | 'testing';

/**
 * Metadata for a registered prompt template.
 */
export interface PromptTemplateMetadata {
  /** Unique template identifier (e.g. "medical/causation-analysis") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Template category */
  category: PromptCategory;
  /** Relative path within the prompts directory */
  filename: string;
  /** Template version for auditability */
  version: string;
  /** Variable names expected by this template */
  variables: string[];
  /** Brief description of the template's purpose */
  description: string;
}

/**
 * A loaded and optionally rendered prompt template.
 */
export interface LoadedPrompt {
  metadata: PromptTemplateMetadata;
  /** Raw template content before variable substitution */
  rawContent: string;
  /** Rendered content after variable substitution */
  content: string;
  /** Variables that were applied during rendering */
  appliedVariables: Record<string, string>;
}

/**
 * Options for loading and rendering a prompt template.
 */
export interface PromptLoadOptions {
  /** Template identifier */
  templateId: string;
  /** Variables to substitute into the template */
  variables?: Record<string, string>;
}
