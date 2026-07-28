/**
 * Knowledge source identifiers for multi-source RAG architecture.
 */
export const KNOWLEDGE_SOURCE_TYPES = {
  INTERNAL_KB: 'internal_kb',
  PUBMED: 'pubmed',
  PMC: 'pmc',
  CLINICAL_TRIALS: 'clinical_trials',
  SEMANTIC_SCHOLAR: 'semantic_scholar',
  CROSSREF: 'crossref',
  WHO: 'who',
  CDC: 'cdc',
} as const;

export type KnowledgeSourceType =
  (typeof KNOWLEDGE_SOURCE_TYPES)[keyof typeof KNOWLEDGE_SOURCE_TYPES];

export const RETRIEVAL_STRATEGIES = {
  VECTOR: 'vector',
  KEYWORD: 'keyword',
  HYBRID: 'hybrid',
} as const;

export type RetrievalStrategy =
  (typeof RETRIEVAL_STRATEGIES)[keyof typeof RETRIEVAL_STRATEGIES];

export const RERANKER_TYPES = {
  SCORE: 'score',
  CROSS_ENCODER: 'cross_encoder',
  COHERE: 'cohere',
  JINA: 'jina',
  BGE: 'bge',
} as const;

export type RerankerType = (typeof RERANKER_TYPES)[keyof typeof RERANKER_TYPES];

export const DOCUMENT_TYPE_FILTERS = {
  BOOK: 'book',
  ARTICLE: 'article',
  REPORT: 'report',
  TEMPLATE: 'template',
  UPLOAD: 'upload',
} as const;

export type DocumentTypeFilter =
  (typeof DOCUMENT_TYPE_FILTERS)[keyof typeof DOCUMENT_TYPE_FILTERS];
