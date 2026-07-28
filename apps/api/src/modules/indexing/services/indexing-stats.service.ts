import { Injectable } from '@nestjs/common';
import { INDEX_STATUS } from '../constants';
import type { IndexingStats } from '../types';
import {
  DocumentChunkRepository,
  EmbeddingRepository,
  IndexedDocumentRepository,
} from '../repositories';

@Injectable()
export class IndexingStatsService {
  constructor(
    private readonly documentRepository: IndexedDocumentRepository,
    private readonly chunkRepository: DocumentChunkRepository,
    private readonly embeddingRepository: EmbeddingRepository,
  ) {}

  async getStats(): Promise<IndexingStats> {
    const [
      statusCounts,
      totalChunks,
      totalEmbeddings,
      averageChunkTokens,
      lastIndexedAt,
    ] = await Promise.all([
      this.documentRepository.countByStatus(),
      this.chunkRepository.countAll(),
      this.embeddingRepository.countAll(),
      this.chunkRepository.averageTokens(),
      this.documentRepository.getLastIndexedAt(),
    ]);

    const totalDocuments = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      totalDocuments,
      indexedDocuments: statusCounts[INDEX_STATUS.INDEXED] ?? 0,
      pendingDocuments: statusCounts[INDEX_STATUS.PENDING] ?? 0,
      processingDocuments: statusCounts[INDEX_STATUS.PROCESSING] ?? 0,
      failedDocuments: statusCounts[INDEX_STATUS.FAILED] ?? 0,
      skippedDocuments: statusCounts[INDEX_STATUS.SKIPPED] ?? 0,
      totalChunks,
      totalEmbeddings,
      averageChunkTokens: Math.round(averageChunkTokens),
      lastIndexedAt,
    };
  }
}
