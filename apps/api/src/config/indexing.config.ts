import type { IndexingConfigSettings } from './config.types';
import {
  DEFAULT_CHUNK_MIN_SIZE_TOKENS,
  DEFAULT_CHUNK_OVERLAP_TOKENS,
  DEFAULT_CHUNK_SIZE_TOKENS,
} from '@modules/indexing/constants';

export const indexingConfig = (): IndexingConfigSettings => ({
  chunkSizeTokens: Number(
    process.env.CHUNK_SIZE_TOKENS ?? DEFAULT_CHUNK_SIZE_TOKENS,
  ),
  chunkOverlapTokens: Number(
    process.env.CHUNK_OVERLAP_TOKENS ?? DEFAULT_CHUNK_OVERLAP_TOKENS,
  ),
  chunkMinSizeTokens: Number(
    process.env.CHUNK_MIN_SIZE_TOKENS ?? DEFAULT_CHUNK_MIN_SIZE_TOKENS,
  ),
  embeddingBatchSize: Number(process.env.EMBEDDING_BATCH_SIZE ?? 100),
  embeddingRetryMaxAttempts: Number(
    process.env.EMBEDDING_RETRY_MAX_ATTEMPTS ?? 3,
  ),
  embeddingRequestTimeoutMs: Number(
    process.env.EMBEDDING_REQUEST_TIMEOUT_MS ?? 30000,
  ),
  embeddingRetryDelayMs: Number(process.env.EMBEDDING_RETRY_DELAY_MS ?? 1000),
});
