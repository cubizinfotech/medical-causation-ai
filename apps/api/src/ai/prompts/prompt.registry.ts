import type { PromptTemplateMetadata } from '@ai/types';

/**
 * Registry of all available prompt templates.
 * Templates are loaded from files in the prompts/ directory at runtime.
 */
export const PROMPT_REGISTRY: PromptTemplateMetadata[] = [
  {
    id: 'system/default',
    name: 'Default System Prompt',
    category: 'system',
    filename: 'system/default.system.prompt.txt',
    version: '1.0.0',
    variables: [],
    description: 'Base system instructions for all AI interactions',
  },
  {
    id: 'medical/causation-analysis',
    name: 'Causation Analysis',
    category: 'medical',
    filename: 'medical/causation-analysis.prompt.txt',
    version: '1.0.0',
    variables: [
      'injuryType',
      'accidentType',
      'patientAge',
      'timeSinceIncident',
      'preExistingConditions',
    ],
    description: 'Analyzes medical causation for a personal injury case',
  },
  {
    id: 'reports/generation',
    name: 'Report Generation',
    category: 'reports',
    filename: 'reports/report-generation.prompt.txt',
    version: '1.0.0',
    variables: [
      'caseReference',
      'attorneyName',
      'reportSection',
      'analysisInput',
    ],
    description: 'Generates attorney-ready report sections from analysis',
  },
  {
    id: 'testing/smoke-test',
    name: 'Smoke Test',
    category: 'testing',
    filename: 'testing/smoke-test.prompt.txt',
    version: '1.0.0',
    variables: ['provider', 'model', 'timestamp'],
    description: 'Verifies AI architecture connectivity',
  },
];

/**
 * Look up a prompt template by its ID.
 */
export function findPromptTemplate(
  templateId: string,
): PromptTemplateMetadata | undefined {
  return PROMPT_REGISTRY.find((t) => t.id === templateId);
}
