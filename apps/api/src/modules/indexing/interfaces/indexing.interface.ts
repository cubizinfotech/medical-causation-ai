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
}

export interface IIndexingJobService {
  createJob(payload: IndexingJobPayload): IndexingJob;
  enqueueJob(job: IndexingJob): Promise<void>;
}
