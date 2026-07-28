import { Injectable, Logger } from '@nestjs/common';
import { DOCUMENT_STATUS } from '@modules/knowledge-base/constants';
import { KnowledgeBaseService } from '@modules/knowledge-base/services/knowledge-base.service';
import { DocumentProcessingService } from '@modules/document-processing/services/document-processing.service';
import { INDEX_STATUS } from '../constants';
import type { IndexDocumentResult } from '../types';
import type { IIndexingService } from '../interfaces';
import { ChunkingService } from '../chunking/chunking.service';
import { IndexingEmbeddingService } from '../embeddings/indexing-embedding.service';
import {
  DocumentChunkRepository,
  EmbeddingRepository,
  IndexedDocumentRepository,
} from '../repositories';
import {
  DocumentNotFoundForIndexingException,
  IndexingFailedException,
} from '../exceptions';
import { IndexingStatsService } from './indexing-stats.service';

/**
 * Knowledge indexing pipeline entry point.
 *
 * Workflow: Document → Parse → Normalize → Chunk → Embed → Store → Update Status
 */
@Injectable()
export class IndexingService implements IIndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: IndexingEmbeddingService,
    private readonly documentRepository: IndexedDocumentRepository,
    private readonly chunkRepository: DocumentChunkRepository,
    private readonly embeddingRepository: EmbeddingRepository,
    private readonly statsService: IndexingStatsService,
  ) {}

  async indexKnowledgeBaseDocument(
    knowledgeDocumentId: string,
    options: { forceReindex?: boolean } = {},
  ): Promise<IndexDocumentResult> {
    const startTime = Date.now();
    const kbDocument =
      await this.knowledgeBaseService.getDocument(knowledgeDocumentId);

    if (!kbDocument) {
      throw new DocumentNotFoundForIndexingException(knowledgeDocumentId);
    }

    const existing =
      await this.documentRepository.findByKnowledgeDocumentId(
        knowledgeDocumentId,
      );

    const isUnchanged =
      existing &&
      existing.checksum === kbDocument.checksum &&
      existing.fileModifiedAt.getTime() === kbDocument.modifiedAt.getTime() &&
      existing.status === INDEX_STATUS.INDEXED;

    if (!options.forceReindex && isUnchanged) {
      this.logger.log(
        `Skipping unchanged document "${kbDocument.filename}" (${knowledgeDocumentId})`,
      );

      return {
        documentId: existing.id,
        knowledgeDocumentId,
        status: INDEX_STATUS.SKIPPED,
        skipped: true,
        skipReason: 'Document checksum and modified date unchanged',
        chunkCount: existing.chunkCount,
        embeddingCount: existing.chunkCount,
        processingDurationMs: Date.now() - startTime,
        indexedAt: existing.indexedAt ?? undefined,
      };
    }

    let indexedDocument = existing;

    if (!indexedDocument) {
      indexedDocument = await this.documentRepository.create({
        knowledgeDocumentId,
        documentTitle: kbDocument.title,
        filename: kbDocument.filename,
        relativePath: kbDocument.relativePath,
        sourceFile: kbDocument.filePath,
        category: kbDocument.category,
        subCategory: kbDocument.subCategory,
        extension: kbDocument.extension,
        checksum: kbDocument.checksum,
        fileSize: BigInt(kbDocument.size),
        fileModifiedAt: kbDocument.modifiedAt,
        pageCount: 0,
        status: INDEX_STATUS.PROCESSING,
      });
    } else {
      indexedDocument = await this.documentRepository.update(
        indexedDocument.id,
        {
          checksum: kbDocument.checksum,
          fileModifiedAt: kbDocument.modifiedAt,
          fileSize: BigInt(kbDocument.size),
          status: INDEX_STATUS.PROCESSING,
          errorMessage: null,
        },
      );
    }

    this.knowledgeBaseService.updateDocumentStatus(
      knowledgeDocumentId,
      DOCUMENT_STATUS.PROCESSING,
    );

    try {
      const processed = await this.documentProcessingService.processDocument({
        filePath: kbDocument.filePath,
        documentId: knowledgeDocumentId,
        relativePath: kbDocument.relativePath,
      });

      const chunkDrafts = this.chunkingService.chunkDocument({
        documentId: knowledgeDocumentId,
        documentTitle: kbDocument.title,
        category: kbDocument.category,
        subCategory: kbDocument.subCategory,
        sourceFile: kbDocument.relativePath,
        relativePath: kbDocument.relativePath,
        normalizedText: processed.normalizedText,
        pages: processed.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
        })),
        sections: processed.sections,
      });

      const storedChunks = await this.chunkRepository.replaceDocumentChunks(
        indexedDocument.id,
        chunkDrafts,
      );

      const externalToInternal = new Map(
        storedChunks.map((chunk) => [chunk.externalChunkId, chunk.id]),
      );

      const embeddings = await this.embeddingService.embedChunks(chunkDrafts);

      const embeddingInputs = embeddings
        .map((embedding) => {
          const internalId = externalToInternal.get(embedding.chunkId);
          if (!internalId) return null;

          return {
            chunkId: internalId,
            provider: embedding.provider,
            model: embedding.model,
            dimensions: embedding.dimensions,
            vector: embedding.vector,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const embeddingCount =
        await this.embeddingRepository.storeEmbeddings(embeddingInputs);

      indexedDocument = await this.documentRepository.update(
        indexedDocument.id,
        {
          pageCount: processed.metadata.pageCount,
          chunkCount: storedChunks.length,
          status: INDEX_STATUS.INDEXED,
          indexedAt: new Date(),
          errorMessage: null,
        },
      );

      this.knowledgeBaseService.updateDocumentStatus(
        knowledgeDocumentId,
        DOCUMENT_STATUS.INDEXED,
      );

      this.logger.log(
        `Indexed "${kbDocument.filename}": ${storedChunks.length} chunks, ${embeddingCount} embeddings`,
      );

      return {
        documentId: indexedDocument.id,
        knowledgeDocumentId,
        status: INDEX_STATUS.INDEXED,
        skipped: false,
        chunkCount: storedChunks.length,
        embeddingCount,
        processingDurationMs: Date.now() - startTime,
        indexedAt: indexedDocument.indexedAt ?? new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.documentRepository.updateStatus(
        indexedDocument.id,
        INDEX_STATUS.FAILED,
        message,
      );

      this.knowledgeBaseService.updateDocumentStatus(
        knowledgeDocumentId,
        DOCUMENT_STATUS.FAILED,
      );

      throw new IndexingFailedException(knowledgeDocumentId, message);
    }
  }

  getStats() {
    return this.statsService.getStats();
  }
}
