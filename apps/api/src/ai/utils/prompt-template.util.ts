import { PROMPT_VARIABLE_PATTERN } from '@ai/constants';
import { InvalidPromptException } from '@ai/exceptions';

/**
 * Extract variable names from a prompt template.
 * Variables use the {{variableName}} syntax.
 */
export function extractPromptVariables(template: string): string[] {
  const variables = new Set<string>();
  const pattern = new RegExp(PROMPT_VARIABLE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Replace {{variable}} placeholders in a template with provided values.
 * Throws InvalidPromptException when required variables are missing.
 */
export function renderPromptTemplate(
  template: string,
  variables: Record<string, string> = {},
): string {
  const required = extractPromptVariables(template);
  const missing = required.filter((key) => !(key in variables));

  if (missing.length > 0) {
    throw new InvalidPromptException(
      `Missing required prompt variables: ${missing.join(', ')}`,
    );
  }

  return template.replace(PROMPT_VARIABLE_PATTERN, (_, key: string) => {
    return variables[key] ?? '';
  });
}

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters).
 * For precise counting, use the provider's tokenizer in a future phase.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate estimated cost from token usage and per-1K rates.
 */
export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  costPer1kPromptTokensUsd: number,
  costPer1kCompletionTokensUsd: number,
): number {
  const promptCost = (promptTokens / 1000) * costPer1kPromptTokensUsd;
  const completionCost =
    (completionTokens / 1000) * costPer1kCompletionTokensUsd;
  return Number((promptCost + completionCost).toFixed(6));
}
