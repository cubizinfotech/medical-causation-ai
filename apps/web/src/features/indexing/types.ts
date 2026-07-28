/**
 * Indexed document types for future UI and API responses.
 */
export type IndexStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "failed"
  | "skipped";

export interface IndexedDocument {
  id: string;
  knowledgeDocumentId: string;
  documentTitle: string;
  filename: string;
  relativePath: string;
  category: string;
  subCategory: string | null;
  checksum: string;
  pageCount: number;
  chunkCount: number;
  status: IndexStatus;
  indexedAt?: string;
  updatedAt: string;
}

export interface DocumentChunk {
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
  createdAt: string;
}

export interface ChunkEmbedding {
  id: string;
  chunkId: string;
  provider: string;
  model: string;
  dimensions: number;
  createdAt: string;
}

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
  lastIndexedAt: string | null;
}

export type IndexingJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface IndexingJob {
  id: string;
  status: IndexingJobStatus;
  knowledgeDocumentId: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
