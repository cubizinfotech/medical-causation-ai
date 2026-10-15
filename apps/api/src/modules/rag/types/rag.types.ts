import type { KnowledgeSourceType } from '../constants';

/**
 * Filters for retrieval queries. Extensible for future sources.
 */
export interface RetrievalFilters {
  /** Filter by knowledge category (medical_book, research_article, etc.) */
  category?: string;
  /** Filter by sub-category / topic folder */
  subCategory?: string;
  /** Filter by document type shorthand (book, article, report, template, upload) */
  documentType?: string;
  /** Filter by indexed document UUID */
  documentId?: string;
  /** Filter by knowledge base document ID */
  knowledgeDocumentId?: string;
  /** Minimum page number (inclusive) */
  pageMin?: number;
  /** Maximum page number (inclusive) */
  pageMax?: number;
  /** File extension filter (pdf, docx, txt, md) */
  extension?: string;
  /** Limit to specific knowledge sources */
  sources?: KnowledgeSourceType[];
}

/**
 * Patient/case context for retrieval query construction.
 * Not stored in retrieval logs.
 */
export interface RetrievalCaseContext {
  question: string;
  patientInformation?: string;
  injury?: string;
  diagnosis?: string;
  symptoms?: string;
  medicalHistory?: string;
}

/**
 * Conversation memory structures (architecture only — no chat yet).
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationContext {
  currentQuestion: string;
  previousQuestions?: string[];
  previousContext?: string;
  previousAnswers?: string[];
  turns?: ConversationTurn[];
}

/**
 * Citation attached to every retrieved chunk.
 */
export interface ChunkCitation {
  documentName: string;
  pageNumber: number | null;
  chunkNumber: number;
  category: string;
  subCategory: string | null;
  similarityScore: number;
  citationText: string;
  sourceFile: string;
  knowledgeDocumentId: string;
}

/**
 * A retrieved knowledge chunk with scores and citation.
 */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  knowledgeDocumentId: string;
  documentTitle: string;
  text: string;
  chunkIndex: number;
  totalChunks: number;
  pageNumber: number | null;
  section: string | null;
  category: string;
  subCategory: string | null;
  sourceFile: string;
  sourceType: KnowledgeSourceType;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
  citation: ChunkCitation;
  /** Similar enough to the case to count as relevant evidence. */
  relevant?: boolean;
}

/** Restricts vector search to vectors made by the query's own model. */
export interface EmbeddingSpace {
  provider: string;
  /** Stored model names that match the query model (spellings can differ). */
  models: string[];
}

/**
 * Internal retrieval query passed to retriever implementations.
 */
export interface RetrievalQuery {
  queryText: string;
  /** OR query of medical terms for keyword search; empty skips it. */
  keywordQuery: string;
  /** Absent when vector search is not possible for this query. */
  embedding?: number[];
  embeddingSpace?: EmbeddingSpace;
  filters: RetrievalFilters;
  topK: number;
}

export type VectorSearchSkipReason =
  'embedding_failed' | 'model_mismatch' | 'no_vectors';

/** How well the library covered this question. */
export interface RetrievalCoverage {
  /** keyword_only: vector search was skipped (see vectorSkipReason). */
  searchMode: 'hybrid' | 'keyword_only';
  vectorSkipReason?: VectorSearchSkipReason;
  /** Passages at or above relevanceThreshold. */
  relevantChunkCount: number;
  topSimilarity: number;
  relevanceThreshold: number;
  /** Enough relevant passages for the library alone to back the analysis. */
  sufficient: boolean;
}

/**
 * Full retrieval request from consumers.
 */
export interface RetrievalRequest {
  question: string;
  patientInformation?: string;
  injury?: string;
  diagnosis?: string;
  symptoms?: string;
  medicalHistory?: string;
  filters?: RetrievalFilters;
  conversationContext?: ConversationContext;
  topK?: number;
  strategy?: import('../constants').RetrievalStrategy;
}

/**
 * Built LLM context ready for augmentation.
 */
export interface BuiltContext {
  contextText: string;
  citations: ChunkCitation[];
  chunkCount: number;
  estimatedTokens: number;
  truncated: boolean;
}

/**
 * Full retrieval result.
 */
export interface RetrievalResult {
  question: string;
  chunks: RetrievedChunk[];
  context: BuiltContext;
  executionTimeMs: number;
  embeddingProvider: string;
  embeddingModel: string;
  strategy: string;
  reranker: string;
  /** Absent only in results built before coverage was measured. */
  coverage?: RetrievalCoverage;
}

/**
 * Retrieval log entry — no sensitive patient data.
 */
export interface RetrievalLogEntry {
  id: string;
  questionHash: string;
  questionLength: number;
  retrievedDocumentIds: string[];
  retrievedChunkIds: string[];
  chunkCount: number;
  executionTimeMs: number;
  embeddingProvider: string;
  embeddingModel: string;
  estimatedContextTokens: number;
  strategy: string;
  reranker: string;
  searchMode?: RetrievalCoverage['searchMode'];
  relevantChunkCount?: number;
  topSimilarity?: number;
  timestamp: Date;
}
