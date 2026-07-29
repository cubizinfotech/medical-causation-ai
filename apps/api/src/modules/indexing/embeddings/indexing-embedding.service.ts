import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@ai/services';
import type { IndexingConfigSettings } from '@config/config.types';
import type { ChunkDraft } from '../types';

/**
 * Generates embeddings for document chunks via the AI service.
 */
@Injectable()
export class IndexingEmbeddingService {
  private readonly logger = new Logger(IndexingEmbeddingService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): IndexingConfigSettings {
    return this.configService.get<IndexingConfigSettings>('indexing')!;
  }

  async embedChunks(chunks: ChunkDraft[]): Promise<
    Array<{
      chunkId: string;
      vector: number[];
      model: string;
      provider: string;
      dimensions: number;
    }>
  > {
    const batchSize = this.config.embeddingBatchSize;
    const results: Array<{
      chunkId: string;
      vector: number[];
      model: string;
      provider: string;
      dimensions: number;
    }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const response = await this.aiService.embed({
        inputs: batch.map((chunk) => ({
          id: chunk.chunkId,
          text: chunk.text,
        })),
      });

      for (const result of response.results) {
        if (!result.id || !result.embedding?.length) continue;

        results.push({
          chunkId: result.id,
          vector: result.embedding,
          model: response.model,
          provider: response.provider,
          dimensions: result.dimensions,
        });
      }

      this.logger.debug(
        `Embedded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} chunks`,
      );

      if (i + batchSize < chunks.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number(process.env.EMBEDDING_BATCH_DELAY_MS ?? 500)),
        );
      }
    }

    return results;
  }
}
