import type { RagConfigSettings } from './config.types';

export const DEFAULT_RAG_TOP_K = 10;
export const DEFAULT_RAG_VECTOR_TOP_K = 20;
export const DEFAULT_RAG_KEYWORD_TOP_K = 20;
export const DEFAULT_RAG_MAX_CONTEXT_TOKENS = 8000;
export const DEFAULT_RAG_VECTOR_WEIGHT = 0.7;
export const DEFAULT_RAG_KEYWORD_WEIGHT = 0.3;
export const DEFAULT_RAG_MIN_SIMILARITY = 0.25;
export const DEFAULT_RAG_RRF_K = 60;
export const DEFAULT_RAG_MIN_RELEVANT_CHUNKS = 3;
export const DEFAULT_RAG_HNSW_EF_SEARCH = 100;

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const ragConfig = (): RagConfigSettings => ({
  topK: Number(process.env.RAG_TOP_K ?? DEFAULT_RAG_TOP_K),
  vectorTopK: Number(process.env.RAG_VECTOR_TOP_K ?? DEFAULT_RAG_VECTOR_TOP_K),
  keywordTopK: Number(
    process.env.RAG_KEYWORD_TOP_K ?? DEFAULT_RAG_KEYWORD_TOP_K,
  ),
  maxContextTokens: Number(
    process.env.RAG_MAX_CONTEXT_TOKENS ?? DEFAULT_RAG_MAX_CONTEXT_TOKENS,
  ),
  vectorWeight: Number(
    process.env.RAG_VECTOR_WEIGHT ?? DEFAULT_RAG_VECTOR_WEIGHT,
  ),
  keywordWeight: Number(
    process.env.RAG_KEYWORD_WEIGHT ?? DEFAULT_RAG_KEYWORD_WEIGHT,
  ),
  minSimilarityScore: Number(
    process.env.RAG_MIN_SIMILARITY_SCORE ?? DEFAULT_RAG_MIN_SIMILARITY,
  ),
  rrfK: Number(process.env.RAG_RRF_K ?? DEFAULT_RAG_RRF_K),
  defaultReranker: process.env.RAG_RERANKER ?? 'score',
  relevanceMinSimilarity: optionalNumber(
    process.env.RAG_RELEVANCE_MIN_SIMILARITY,
  ),
  minRelevantChunks: Number(
    process.env.RAG_MIN_RELEVANT_CHUNKS ?? DEFAULT_RAG_MIN_RELEVANT_CHUNKS,
  ),
  hnswEfSearch: Number(
    process.env.RAG_HNSW_EF_SEARCH ?? DEFAULT_RAG_HNSW_EF_SEARCH,
  ),
});
