/**
 * Indexing and chunking configuration defaults.
 */
export const DEFAULT_CHUNK_SIZE_TOKENS = 512;
export const DEFAULT_CHUNK_OVERLAP_TOKENS = 64;
export const DEFAULT_CHUNK_MIN_SIZE_TOKENS = 50;

export const INDEX_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  INDEXED: 'indexed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type IndexStatus = (typeof INDEX_STATUS)[keyof typeof INDEX_STATUS];

export const INDEXING_JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type IndexingJobStatus =
  (typeof INDEXING_JOB_STATUS)[keyof typeof INDEXING_JOB_STATUS];

export const INDEXING_JOB_TYPE = 'knowledge-base.index-document' as const;
