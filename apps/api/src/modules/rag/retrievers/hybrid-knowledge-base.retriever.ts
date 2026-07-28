import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RagConfigSettings } from '@config/config.types';
import { KNOWLEDGE_SOURCE_TYPES, RETRIEVAL_STRATEGIES } from '../constants';
import type { IKnowledgeRetriever } from '../interfaces';
import type { RetrievalQuery, RetrievedChunk } from '../types';
import { ChunkSearchRepository, type ChunkSearchRow } from '../repositories';
import { CitationManager } from '../builders';
import { reciprocalRankFusion } from '../utils';

@Injectable()
export class VectorRetriever {
  constructor(private readonly chunkSearch: ChunkSearchRepository) {}

  async retrieve(
    query: RetrievalQuery,
    minSimilarity: number,
  ): Promise<ChunkSearchRow[]> {
    return this.chunkSearch.searchByVector(
      query.embedding,
      query.filters,
      query.topK,
      minSimilarity,
    );
  }
}

@Injectable()
export class KeywordRetriever {
  constructor(private readonly chunkSearch: ChunkSearchRepository) {}

  async retrieve(query: RetrievalQuery): Promise<ChunkSearchRow[]> {
    return this.chunkSearch.searchByKeyword(
      query.queryText,
      query.filters,
      query.topK,
    );
  }
}

@Injectable()
export class HybridKnowledgeBaseRetriever implements IKnowledgeRetriever {
  readonly sourceType = KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB;
  private readonly logger = new Logger(HybridKnowledgeBaseRetriever.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly vectorRetriever: VectorRetriever,
    private readonly keywordRetriever: KeywordRetriever,
    private readonly citationManager: CitationManager,
  ) {}

  private get config(): RagConfigSettings {
    return this.configService.get<RagConfigSettings>('rag')!;
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievedChunk[]> {
    const [vectorRows, keywordRows] = await Promise.all([
      this.vectorRetriever.retrieve(
        { ...query, topK: this.config.vectorTopK },
        this.config.minSimilarityScore,
      ),
      this.keywordRetriever.retrieve({
        ...query,
        topK: this.config.keywordTopK,
      }),
    ]);

    const vectorRanked = vectorRows.map((row) => ({
      id: row.chunk_id,
      score: Number(row.score),
    }));
    const keywordRanked = keywordRows.map((row) => ({
      id: row.chunk_id,
      score: Number(row.score),
    }));

    const fusedScores = reciprocalRankFusion(
      [vectorRanked, keywordRanked],
      this.config.rrfK,
    );

    const rowMap = new Map<string, ChunkSearchRow>();
    for (const row of [...vectorRows, ...keywordRows]) {
      rowMap.set(row.chunk_id, row);
    }

    const vectorScoreMap = new Map(
      vectorRows.map((r) => [r.chunk_id, Number(r.score)]),
    );
    const keywordScoreMap = new Map(
      keywordRows.map((r) => [r.chunk_id, Number(r.score)]),
    );

    const merged = [...fusedScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, query.topK)
      .map(([chunkId, fusedScore]) => {
        const row = rowMap.get(chunkId)!;
        const vectorScore = vectorScoreMap.get(chunkId) ?? 0;
        const keywordScore = keywordScoreMap.get(chunkId) ?? 0;
        const combinedScore =
          vectorScore * this.config.vectorWeight +
          keywordScore * this.config.keywordWeight +
          fusedScore;

        return this.toRetrievedChunk(
          row,
          vectorScore,
          keywordScore,
          combinedScore,
        );
      })
      .filter(Boolean);

    this.logger.debug(
      `Hybrid retrieval: ${vectorRows.length} vector + ${keywordRows.length} keyword → ${merged.length} merged`,
    );

    return merged;
  }

  private toRetrievedChunk(
    row: ChunkSearchRow,
    vectorScore: number,
    keywordScore: number,
    combinedScore: number,
  ): RetrievedChunk {
    const base = {
      chunkId: row.external_chunk_id,
      documentId: row.document_id,
      knowledgeDocumentId: row.knowledge_document_id,
      documentTitle: row.document_title,
      text: row.text,
      chunkIndex: row.chunk_index,
      totalChunks: row.total_chunks,
      pageNumber: row.page_number,
      section: row.section,
      category: row.category,
      subCategory: row.sub_category,
      sourceFile: row.source_file,
      sourceType: this.sourceType,
      vectorScore,
      keywordScore,
      combinedScore,
    };

    return {
      ...base,
      citation: this.citationManager.buildCitation(base),
    };
  }
}

/**
 * Registry of knowledge retrievers. Add new sources here without modifying RAG engine.
 */
@Injectable()
export class RetrieverRegistry {
  private readonly retrievers: Map<string, IKnowledgeRetriever>;

  constructor(hybridKbRetriever: HybridKnowledgeBaseRetriever) {
    this.retrievers = new Map([
      [KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB, hybridKbRetriever],
    ]);
  }

  getRetriever(sourceType: string): IKnowledgeRetriever | undefined {
    return this.retrievers.get(sourceType);
  }

  getActiveRetrievers(requestedSources?: string[]): IKnowledgeRetriever[] {
    if (!requestedSources?.length) {
      return [this.retrievers.get(KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB)!];
    }

    return requestedSources
      .map((source) => this.retrievers.get(source))
      .filter((r): r is IKnowledgeRetriever => Boolean(r));
  }
}

export { RETRIEVAL_STRATEGIES };
