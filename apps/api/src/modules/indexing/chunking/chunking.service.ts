import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IndexingConfigSettings } from '@config/config.types';
import type { ChunkDraft, ChunkingInput } from '../types';
import {
  buildExternalChunkId,
  buildTextSegments,
  estimateTokensFromText,
  hashChunkContent,
  splitTextSegment,
} from '../utils';

/**
 * Token-aware document chunking for medical books and research papers.
 */
@Injectable()
export class ChunkingService {
  constructor(private readonly configService: ConfigService) {}

  private get config(): IndexingConfigSettings {
    return this.configService.get<IndexingConfigSettings>('indexing')!;
  }

  chunkDocument(input: ChunkingInput): ChunkDraft[] {
    const segments = buildTextSegments({
      normalizedText: input.normalizedText,
      pages: input.pages,
      sections: input.sections,
    });

    const rawChunks = segments.flatMap((segment) =>
      splitTextSegment(
        segment,
        this.config.chunkSizeTokens,
        this.config.chunkOverlapTokens,
        this.config.chunkMinSizeTokens,
      ),
    );

    const totalChunks = rawChunks.length;
    const createdAt = new Date();

    return rawChunks.map((chunk, chunkIndex) => {
      const contentHash = hashChunkContent(chunk.text);

      return {
        chunkId: buildExternalChunkId(input.documentId, chunkIndex),
        documentId: input.documentId,
        documentTitle: input.documentTitle,
        category: input.category,
        subCategory: input.subCategory,
        pageNumber: chunk.pageNumber,
        chunkIndex,
        totalChunks,
        text: chunk.text,
        estimatedTokens: estimateTokensFromText(chunk.text),
        section: chunk.section,
        sourceFile: input.sourceFile,
        createdAt,
        contentHash,
      };
    });
  }
}
