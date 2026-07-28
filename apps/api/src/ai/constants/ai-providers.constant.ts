/**
 * Supported LLM provider identifiers.
 * Must match the `AI_PROVIDER` environment variable value.
 */
export const LLM_PROVIDERS = {
  OPENROUTER: 'openrouter',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  GROQ: 'groq',
} as const;

export type LlmProviderName =
  (typeof LLM_PROVIDERS)[keyof typeof LLM_PROVIDERS];

export const DEFAULT_LLM_PROVIDER: LlmProviderName = LLM_PROVIDERS.OPENROUTER;

/**
 * Supported embedding provider identifiers.
 * Must match the `EMBEDDING_PROVIDER` environment variable value.
 */
export const EMBEDDING_PROVIDERS = {
  OPENAI: 'openai',
  OPENROUTER: 'openrouter',
  GEMINI: 'gemini',
  VOYAGE: 'voyage',
  JINA: 'jina',
  NOMIC: 'nomic',
  OLLAMA: 'ollama',
  GROQ: 'groq',
} as const;

export type EmbeddingProviderName =
  (typeof EMBEDDING_PROVIDERS)[keyof typeof EMBEDDING_PROVIDERS];

export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProviderName =
  EMBEDDING_PROVIDERS.OPENAI;

/**
 * Default models per LLM provider when AI_CHAT_MODEL is not set.
 */
export const DEFAULT_LLM_MODELS: Record<LlmProviderName, string> = {
  [LLM_PROVIDERS.OPENROUTER]: 'openai/gpt-4o',
  [LLM_PROVIDERS.OPENAI]: 'gpt-4o',
  [LLM_PROVIDERS.ANTHROPIC]: 'claude-sonnet-4-20250514',
  [LLM_PROVIDERS.GEMINI]: 'gemini-2.0-flash',
  [LLM_PROVIDERS.GROQ]: 'llama-3.3-70b-versatile',
};

/**
 * Default models per embedding provider when AI_EMBEDDING_MODEL is not set.
 */
export const DEFAULT_EMBEDDING_MODELS: Record<EmbeddingProviderName, string> = {
  [EMBEDDING_PROVIDERS.OPENAI]: 'text-embedding-3-small',
  [EMBEDDING_PROVIDERS.OPENROUTER]: 'openai/text-embedding-3-small',
  [EMBEDDING_PROVIDERS.GEMINI]: 'text-embedding-004',
  [EMBEDDING_PROVIDERS.VOYAGE]: 'voyage-3',
  [EMBEDDING_PROVIDERS.JINA]: 'jina-embeddings-v3',
  [EMBEDDING_PROVIDERS.NOMIC]: 'nomic-embed-text',
  [EMBEDDING_PROVIDERS.OLLAMA]: 'nomic-embed-text',
  [EMBEDDING_PROVIDERS.GROQ]: 'nomic-embed-text',
};

/**
 * Prompt template variable delimiter pattern: {{variableName}}
 */
export const PROMPT_VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Injection token for the active LLM provider.
 */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/**
 * Injection token for the active embedding provider.
 */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
