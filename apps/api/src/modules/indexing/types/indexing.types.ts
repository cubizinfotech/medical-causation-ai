import type { IndexStatus } from '../constants';

/**
 * Metadata attached to every document chunk.
 */
export interface ChunkMetadata {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  subCategory: string | null;
  pageNumber: number | null;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  estimatedTokens: number;
  section: string | null;
  sourceFile: string;
  createdAt: Date;
}

/**
 * Draft chunk produced by the chunking engine before persistence.
 */
export interface ChunkDraft extends ChunkMetadata {
  contentHash: string;
}

/**
 * Input for the chunking engine.
 */
export interface ChunkingInput {
  documentId: string;
  documentTitle: string;
  category: string;
  subCategory: string | null;
  sourceFile: string;
  relativePath: string;
  normalizedText: string;
  pages: Array<{ pageNumber: number; text: string }>;
  sections: Array<{
    type: string;
    content: string;
    level?: number;
    order: number;
  }>;
}

/**
 * Result of indexing a single document.
 */
export interface IndexDocumentResult {
  documentId: string;
  knowledgeDocumentId: string;
  status: IndexStatus;
  skipped: boolean;
  skipReason?: string;
  chunkCount: number;
  embeddingCount: number;
  processingDurationMs: number;
  indexedAt?: Date;
  error?: string;
}

/**
 * Payload for future BullMQ indexing jobs.
 */
export interface IndexingJobPayload {
  knowledgeDocumentId: string;
  forceReindex?: boolean;
  requestedAt: string;
  requestedBy?: string;
}

/**
 * Indexing job descriptor (queue-ready, not yet enqueued).
 */
export interface IndexingJob {
  id: string;
  type: typeof import('../constants').INDEXING_JOB_TYPE;
  status: import('../constants').IndexingJobStatus;
  payload: IndexingJobPayload;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Dashboard statistics for indexing monitoring.
 */
export interface IndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  pendingDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  skippedDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  averageChunkTokens: number;
  lastIndexedAt: Date | null;
}
