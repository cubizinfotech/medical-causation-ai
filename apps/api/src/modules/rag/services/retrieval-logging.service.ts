import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RetrievalLogEntry } from '../types';
import { hashQuestion } from '../utils';

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

    this.logger.log(
      `Retrieval ${record.id}: ${record.chunkCount} chunks, ${record.executionTimeMs}ms, ` +
        `provider=${record.embeddingProvider}, tokens≈${record.estimatedContextTokens}`,
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
