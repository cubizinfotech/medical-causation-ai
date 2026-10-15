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

    // A PDF can repeat a passage word for word (a reprinted page or
    // abstract); the second copy adds nothing to search, so keep one.
    const seen = new Set<string>();
    const unique = chunks.filter((chunk) => {
      if (seen.has(chunk.contentHash)) return false;
      seen.add(chunk.contentHash);
      return true;
    });

    await this.prisma.documentChunk.createMany({
      skipDuplicates: true,
      data: unique.map((chunk) => ({
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

  findByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    return this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
  }
}
