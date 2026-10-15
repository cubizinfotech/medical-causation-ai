import type { ConfigService } from '@nestjs/config';
import type { AiService } from '@ai/services';
import { ProviderUnavailableException } from '@ai/exceptions';
import type { RagConfigSettings } from '@config/config.types';
import { ContextBuilder } from '../builders';
import type { RetrieverRegistry } from '../retrievers';
import { RerankerRegistry, ScoreBasedReranker } from '../rerankers';
import type { ChunkSearchRepository } from '../repositories';
import type { RetrievalQuery, RetrievedChunk } from '../types';
import { RetrievalLoggingService } from './retrieval-logging.service';
import {
  RetrievalService,
  defaultRelevanceThreshold,
} from './retrieval.service';

const rag: RagConfigSettings = {
  topK: 10,
  vectorTopK: 20,
  keywordTopK: 20,
  maxContextTokens: 8000,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  minSimilarityScore: 0.25,
  rrfK: 60,
  defaultReranker: 'score',
  minRelevantChunks: 2,
  hnswEfSearch: 100,
};

function chunk(
  id: string,
  vectorScore: number,
  keywordScore = 0,
): RetrievedChunk {
  return {
    chunkId: id,
    documentId: 'doc',
    knowledgeDocumentId: 'kb',
    documentTitle: 'Book',
    text: `text ${id}`,
    chunkIndex: 0,
    totalChunks: 1,
    pageNumber: 1,
    section: null,
    category: 'medical_book',
    subCategory: null,
    sourceFile: 'book.pdf',
    sourceType: 'internal_kb',
    vectorScore,
    keywordScore,
    combinedScore: vectorScore + keywordScore,
    citation: {
      documentName: 'Book',
      pageNumber: 1,
      chunkNumber: 1,
      category: 'medical_book',
      subCategory: null,
      similarityScore: vectorScore,
      citationText: `[${id}]`,
      sourceFile: 'book.pdf',
      knowledgeDocumentId: 'kb',
    },
  };
}

describe('RetrievalService', () => {
  let embed: jest.Mock;
  let retrieve: jest.Mock<Promise<RetrievedChunk[]>, [RetrievalQuery]>;
  let storedEmbeddingSpaces: jest.Mock;

  function build(): RetrievalService {
    return new RetrievalService(
      { get: () => rag } as unknown as ConfigService,
      {
        embed,
        getActiveEmbeddingTarget: () => ({
          provider: 'gemini',
          model: 'gemini-embedding-2',
        }),
      } as unknown as AiService,
      {
        getActiveRetrievers: () => [{ sourceType: 'internal_kb', retrieve }],
      } as unknown as RetrieverRegistry,
      new RerankerRegistry(new ScoreBasedReranker()),
      new ContextBuilder(),
      new RetrievalLoggingService(),
      { storedEmbeddingSpaces } as unknown as ChunkSearchRepository,
    );
  }

  beforeEach(() => {
    embed = jest.fn().mockResolvedValue({
      results: [{ embedding: [0.1, 0.2] }],
      provider: 'gemini',
      model: 'gemini-embedding-2',
    });
    retrieve = jest
      .fn<Promise<RetrievedChunk[]>, [RetrievalQuery]>()
      .mockResolvedValue([
        chunk('a', 0.8, 0.5),
        chunk('b', 0.78),
        chunk('c', 0.6, 0.4),
      ]);
    storedEmbeddingSpaces = jest
      .fn()
      .mockResolvedValue([
        { provider: 'gemini', model: 'gemini-embedding-2', vectors: 100 },
      ]);
  });

  const request = {
    question: 'Did the mild traumatic brain injury cause the ischemic stroke?',
    diagnosis: 'Ischemic stroke',
  };

  it('searches by meaning and keywords and measures library coverage', async () => {
    const result = await build().retrieve(request);

    const query = retrieve.mock.calls[0][0];
    expect(query.embedding).toEqual([0.1, 0.2]);
    expect(query.embeddingSpace).toEqual({
      provider: 'gemini',
      models: ['gemini-embedding-2'],
    });
    expect(query.keywordQuery).toContain('stroke');
    expect(result.coverage).toEqual({
      searchMode: 'hybrid',
      relevantChunkCount: 2,
      topSimilarity: 0.8,
      relevanceThreshold: 0.75,
      sufficient: true,
    });
    expect(result.chunks.find((c) => c.chunkId === 'c')?.relevant).toBe(false);
  });

  it('skips the embedding call when library vectors come from another model', async () => {
    storedEmbeddingSpaces.mockResolvedValue([
      {
        provider: 'openrouter',
        model: 'text-embedding-3-small',
        vectors: 1481,
      },
    ]);

    const result = await build().retrieve(request);

    // Vectors from another model are not comparable: no paid call, no
    // vector search, keyword search still runs.
    expect(embed).not.toHaveBeenCalled();
    expect(retrieve.mock.calls[0][0].embedding).toBeUndefined();
    expect(result.coverage).toMatchObject({
      searchMode: 'keyword_only',
      vectorSkipReason: 'model_mismatch',
      sufficient: false,
    });
  });

  it('keeps searching by keyword when the query embedding fails', async () => {
    embed.mockRejectedValue(
      new ProviderUnavailableException('gemini', 'timed out', 'timeout'),
    );

    const result = await build().retrieve(request);

    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 2 }),
    );
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.coverage).toMatchObject({
      searchMode: 'keyword_only',
      vectorSkipReason: 'embedding_failed',
      relevantChunkCount: 0,
      sufficient: false,
    });
  });

  it('reports an empty library without calling the embedding provider', async () => {
    storedEmbeddingSpaces.mockResolvedValue([]);
    retrieve.mockResolvedValue([]);

    const result = await build().retrieve(request);

    expect(embed).not.toHaveBeenCalled();
    expect(result.coverage).toMatchObject({
      vectorSkipReason: 'no_vectors',
      sufficient: false,
    });
  });
});

describe('defaultRelevanceThreshold', () => {
  it('uses a threshold suited to each embedding model family', () => {
    expect(defaultRelevanceThreshold('gemini-embedding-2')).toBe(0.75);
    expect(defaultRelevanceThreshold('text-embedding-3-small')).toBe(0.45);
    expect(defaultRelevanceThreshold('nomic-embed-text')).toBe(0.5);
  });
});
