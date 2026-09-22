import type { RetrievalResult } from '@modules/rag/types';

export function createMockRetrievalResult(
  overrides: Partial<RetrievalResult> = {},
): RetrievalResult {
  return {
    question: 'Test question?',
    chunks: [],
    context: {
      contextText: 'Retrieved context',
      citations: [],
      chunkCount: 0,
      estimatedTokens: 0,
      truncated: false,
    },
    executionTimeMs: 10,
    embeddingProvider: 'openrouter',
    embeddingModel: 'openai/text-embedding-3-small',
    strategy: 'hybrid',
    reranker: 'score',
    ...overrides,
  };
}
