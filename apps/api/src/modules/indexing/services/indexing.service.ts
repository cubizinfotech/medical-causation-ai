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

    const embeddingCount = existing
      ? await this.embeddingRepository.countForDocument(existing.id)
      : 0;

    const hasCompleteEmbeddings =
      existing !== null &&
      embeddingCount > 0 &&
      embeddingCount >= existing.chunkCount;

    const isUnchanged =
      existing &&
      existing.checksum === kbDocument.checksum &&
      existing.fileModifiedAt.getTime() === kbDocument.modifiedAt.getTime() &&
      existing.status === INDEX_STATUS.INDEXED &&
      hasCompleteEmbeddings;

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

      // A scan that OCR could not read gives no passages. Marked as indexed,
      // it looked searchable and later stopped re-embedding; mark it failed
      // with the reason instead.
      if (storedChunks.length === 0) {
        throw new Error(
          'No readable text: the file looks scanned or empty and OCR did not read it, so it cannot be searched.',
        );
      }

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

  /**
   * Embeds chunks that have no vector, or a vector from another provider or
   * model (after EMBEDDING_PROVIDER or AI_EMBEDDING_MODEL changes). Old
   * vectors are replaced one batch at a time, so search keeps working while
   * this runs. A document that fails is reported and the rest continue.
   */
  async reembedAllMissingEmbeddings(): Promise<IndexDocumentResult[]> {
    const documents = await this.documentRepository.findAllIndexed();
    const results: IndexDocumentResult[] = [];
    const isCurrent = this.embeddingService.isCurrentEmbedding();

    for (const document of documents) {
      // Nothing to embed (e.g. a scan OCR could not read). Indexing marks
      // such files failed now; older rows can still say indexed.
      if (document.chunkCount === 0) {
        this.logger.warn(
          `Skipping "${document.filename}": it has no readable passages to embed. Run npm run index:kb to re-check the file.`,
        );
        continue;
      }

      const current =
        await this.embeddingRepository.findCurrentEmbeddedChunkIds(
          document.id,
          isCurrent,
        );

      if (current.size >= document.chunkCount) {
        continue;
      }

      const startTime = Date.now();
      try {
        results.push(await this.reembedDocument(document, current));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Re-embedding "${document.filename}" failed; continuing with the other documents: ${message}`,
        );
        results.push({
          documentId: document.id,
          knowledgeDocumentId: document.knowledgeDocumentId,
          status: INDEX_STATUS.FAILED,
          skipped: false,
          chunkCount: document.chunkCount,
          embeddingCount: current.size,
          processingDurationMs: Date.now() - startTime,
          error: message,
        });
      }
    }

    return results;
  }

  async clearAllEmbeddings(): Promise<number> {
    const deleted = await this.embeddingRepository.deleteAll();
    this.logger.warn(`Cleared ${deleted} stored embedding vector(s)`);
    return deleted;
  }

  private async reembedDocument(
    indexedDocument: Awaited<
      ReturnType<IndexedDocumentRepository['findAllIndexed']>
    >[number],
    embeddedChunkIds: Set<string>,
  ): Promise<IndexDocumentResult> {
    const startTime = Date.now();
    const storedChunks = await this.chunkRepository.findByDocumentId(
      indexedDocument.id,
    );

    if (storedChunks.length === 0) {
      throw new IndexingFailedException(
        indexedDocument.knowledgeDocumentId,
        'No stored chunks found for re-embedding',
      );
    }

    const chunksToEmbed = storedChunks.filter(
      (chunk) => !embeddedChunkIds.has(chunk.id),
    );

    if (chunksToEmbed.length === 0) {
      this.logger.log(
        `Skipping re-embed for "${indexedDocument.filename}" — all chunks already embedded`,
      );
      return {
        documentId: indexedDocument.id,
        knowledgeDocumentId: indexedDocument.knowledgeDocumentId,
        status: INDEX_STATUS.INDEXED,
        skipped: true,
        chunkCount: storedChunks.length,
        embeddingCount: embeddedChunkIds.size,
        processingDurationMs: Date.now() - startTime,
        indexedAt: indexedDocument.indexedAt ?? new Date(),
      };
    }

    this.logger.log(
      `Re-embedding "${indexedDocument.filename}": ${chunksToEmbed.length} remaining of ${storedChunks.length} chunks`,
    );

    const chunkDrafts = chunksToEmbed.map((chunk) => ({
      chunkId: chunk.externalChunkId,
      documentId: indexedDocument.knowledgeDocumentId,
      documentTitle: indexedDocument.documentTitle,
      category: indexedDocument.category,
      subCategory: indexedDocument.subCategory,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      text: chunk.text,
      estimatedTokens: chunk.estimatedTokens,
      section: chunk.section,
      sourceFile: indexedDocument.sourceFile,
      createdAt: chunk.createdAt,
      contentHash: chunk.contentHash,
    }));

    const externalToInternal = new Map(
      chunksToEmbed.map((chunk) => [chunk.externalChunkId, chunk.id]),
    );

    const persistBatchSize = Number(process.env.EMBEDDING_BATCH_SIZE ?? 32);
    let embeddingCount = 0;

    for (let i = 0; i < chunkDrafts.length; i += persistBatchSize) {
      const batch = chunkDrafts.slice(i, i + persistBatchSize);
      const embeddings = await this.embeddingService.embedChunks(batch);

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

      embeddingCount +=
        await this.embeddingRepository.storeEmbeddings(embeddingInputs);

      this.logger.log(
        `Re-embed progress "${indexedDocument.filename}": ${Math.min(i + persistBatchSize, chunkDrafts.length)}/${chunkDrafts.length} remaining chunks`,
      );
    }

    await this.documentRepository.update(indexedDocument.id, {
      status: INDEX_STATUS.INDEXED,
      indexedAt: new Date(),
      errorMessage: null,
    });

    this.logger.log(
      `Re-embedded "${indexedDocument.filename}": ${storedChunks.length} chunks total, ${embeddingCount} new embeddings stored`,
    );

    const totalEmbeddings = await this.embeddingRepository.countForDocument(
      indexedDocument.id,
    );

    return {
      documentId: indexedDocument.id,
      knowledgeDocumentId: indexedDocument.knowledgeDocumentId,
      status: INDEX_STATUS.INDEXED,
      skipped: false,
      chunkCount: storedChunks.length,
      embeddingCount: totalEmbeddings,
      processingDurationMs: Date.now() - startTime,
      indexedAt: new Date(),
    };
  }

  getStats() {
    return this.statsService.getStats();
  }
}
