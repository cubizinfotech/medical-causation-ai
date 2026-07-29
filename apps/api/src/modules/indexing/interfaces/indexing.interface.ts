import type {
  IndexDocumentResult,
  IndexingJob,
  IndexingJobPayload,
  IndexingStats,
} from '../types';

export interface IIndexingService {
  indexKnowledgeBaseDocument(
    knowledgeDocumentId: string,
    options?: { forceReindex?: boolean },
  ): Promise<IndexDocumentResult>;

  getStats(): Promise<IndexingStats>;

  /** Re-generate embeddings for indexed documents that have chunks but missing vectors. */
  reembedAllMissingEmbeddings(): Promise<IndexDocumentResult[]>;
}

export interface IIndexingJobService {
  createJob(payload: IndexingJobPayload): IndexingJob;
  enqueueJob(job: IndexingJob): Promise<void>;
}
