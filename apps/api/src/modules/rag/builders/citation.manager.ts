import { Injectable } from '@nestjs/common';
import type { ICitationManager } from '../interfaces';
import type { ChunkCitation, RetrievedChunk } from '../types';

@Injectable()
export class CitationManager implements ICitationManager {
  buildCitation(chunk: Omit<RetrievedChunk, 'citation'>): ChunkCitation {
    const pagePart =
      chunk.pageNumber !== null ? `, p. ${chunk.pageNumber}` : '';
    const citationText = `[Source: ${chunk.documentTitle}${pagePart}, chunk ${chunk.chunkIndex + 1}]`;

    return {
      documentName: chunk.documentTitle,
      pageNumber: chunk.pageNumber,
      chunkNumber: chunk.chunkIndex + 1,
      category: chunk.category,
      subCategory: chunk.subCategory,
      similarityScore: chunk.combinedScore,
      citationText,
      sourceFile: chunk.sourceFile,
      knowledgeDocumentId: chunk.knowledgeDocumentId,
    };
  }
}
