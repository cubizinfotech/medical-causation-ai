import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RetrievalLogEntry } from '../types';
import { hashQuestion } from '../utils';

/** Recent entries kept in memory; older ones are dropped. */
const MAX_LOG_ENTRIES = 200;

/**
 * In-memory retrieval logging. Future phase will persist to audit store.
 * Never logs sensitive patient information.
 */
@Injectable()
export class RetrievalLoggingService {
  private readonly logger = new Logger(RetrievalLoggingService.name);
  private readonly logs: RetrievalLogEntry[] = [];

  log(entry: Omit<RetrievalLogEntry, 'id' | 'timestamp'>): RetrievalLogEntry {
    const record: RetrievalLogEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    this.logs.push(record);
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
    }

    const coverage =
      record.searchMode !== undefined
        ? `, search=${record.searchMode}, relevant=${record.relevantChunkCount ?? 0}, top=${record.topSimilarity ?? 0}`
        : '';
    this.logger.log(
      `Retrieval ${record.id}: ${record.chunkCount} chunks, ${record.executionTimeMs}ms, ` +
        `provider=${record.embeddingProvider}, model=${record.embeddingModel}, tokens≈${record.estimatedContextTokens}${coverage}`,
    );

    return record;
  }

  getRecentLogs(limit = 50): RetrievalLogEntry[] {
    return this.logs.slice(-limit);
  }

  createQuestionFingerprint(question: string): {
    questionHash: string;
    questionLength: number;
  } {
    return {
      questionHash: hashQuestion(question),
      questionLength: question.length,
    };
  }
}
