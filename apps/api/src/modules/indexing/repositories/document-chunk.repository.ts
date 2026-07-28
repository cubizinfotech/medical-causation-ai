import { Injectable } from '@nestjs/common';
import type { DocumentChunk } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { ChunkDraft } from '../types';

@Injectable()
export class DocumentChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceDocumentChunks(
    documentId: string,
    chunks: ChunkDraft[],
  ): Promise<DocumentChunk[]> {
    await this.prisma.documentChunk.deleteMany({ where: { documentId } });

    if (chunks.length === 0) return [];

    await this.prisma.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        externalChunkId: chunk.chunkId,
        documentId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        pageNumber: chunk.pageNumber,
        section: chunk.section,
        text: chunk.text,
        estimatedTokens: chunk.estimatedTokens,
        contentHash: chunk.contentHash,
      })),
    });

    return this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  countAll(): Promise<number> {
    return this.prisma.documentChunk.count();
  }

  averageTokens(): Promise<number> {
    return this.prisma.documentChunk
      .aggregate({ _avg: { estimatedTokens: true } })
      .then((result) => result._avg.estimatedTokens ?? 0);
  }
}
