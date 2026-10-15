import type { KnowledgeBaseService } from '@modules/knowledge-base/services/knowledge-base.service';
import type { DocumentProcessingService } from '@modules/document-processing/services/document-processing.service';
import type { ChunkingService } from '../chunking/chunking.service';
import type { IndexingEmbeddingService } from '../embeddings/indexing-embedding.service';
import type {
  DocumentChunkRepository,
  EmbeddingRepository,
  IndexedDocumentRepository,
} from '../repositories';
import type { IndexingStatsService } from './indexing-stats.service';
import { IndexingService } from './indexing.service';

function document(id: string, chunkCount: number) {
  return {
    id,
    knowledgeDocumentId: `kb-${id}`,
    filename: `${id}.pdf`,
    documentTitle: id,
    category: 'research_article',
    subCategory: null,
    sourceFile: `${id}.pdf`,
    chunkCount,
    indexedAt: new Date('2026-10-14T00:00:00Z'),
  };
}

function chunk(documentId: string, index: number) {
  return {
    id: `${documentId}-chunk-${index}`,
    externalChunkId: `${documentId}:${index}`,
    chunkIndex: index,
    totalChunks: 1,
    pageNumber: 1,
    section: null,
    text: `text ${index}`,
    estimatedTokens: 2,
    contentHash: `hash-${documentId}-${index}`,
    createdAt: new Date(),
  };
}

describe('IndexingService.reembedAllMissingEmbeddings', () => {
  const documents = [
    document('scan', 0),
    document('broken', 1),
    document('good', 1),
  ];
  const findByDocumentId = jest.fn((id: string) =>
    Promise.resolve(id === 'scan' ? [] : [chunk(id, 0)]),
  );
  const embedChunks = jest.fn(
    (drafts: Array<{ chunkId: string; documentId: string }>) => {
      if (drafts[0].documentId === 'kb-broken') {
        return Promise.reject(new Error('provider down'));
      }
      return Promise.resolve(
        drafts.map((draft) => ({
          chunkId: draft.chunkId,
          vector: [1, 2, 3],
          model: 'gemini-embedding-2',
          provider: 'gemini',
          dimensions: 3,
        })),
      );
    },
  );
  const storeEmbeddings = jest.fn((inputs: unknown[]) =>
    Promise.resolve(inputs.length),
  );

  function build(): IndexingService {
    return new IndexingService(
      {} as KnowledgeBaseService,
      {} as DocumentProcessingService,
      {} as ChunkingService,
      {
        embedChunks,
        isCurrentEmbedding: () => () => true,
      } as unknown as IndexingEmbeddingService,
      {
        findAllIndexed: () => Promise.resolve(documents),
        update: () => Promise.resolve({}),
      } as unknown as IndexedDocumentRepository,
      { findByDocumentId } as unknown as DocumentChunkRepository,
      {
        findCurrentEmbeddedChunkIds: () => Promise.resolve(new Set<string>()),
        storeEmbeddings,
        countForDocument: () => Promise.resolve(1),
      } as unknown as EmbeddingRepository,
      {} as IndexingStatsService,
    );
  }

  it('skips documents without passages and carries on after a failure', async () => {
    const results = await build().reembedAllMissingEmbeddings();

    // The unreadable scan is skipped instead of stopping the run.
    expect(findByDocumentId).not.toHaveBeenCalledWith('scan');
    // One failed document is reported; the next one is still embedded.
    expect(results).toEqual([
      expect.objectContaining({
        knowledgeDocumentId: 'kb-broken',
        status: 'failed',
        error: 'provider down',
      }),
      expect.objectContaining({
        knowledgeDocumentId: 'kb-good',
        status: 'indexed',
        embeddingCount: 1,
      }),
    ]);
    expect(storeEmbeddings).toHaveBeenCalledTimes(1);
  });
});
