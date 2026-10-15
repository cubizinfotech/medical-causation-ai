import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { buildFilterClauses, toVectorLiteral } from '../utils';
import type { EmbeddingSpace, RetrievalFilters } from '../types';

export interface ChunkSearchRow {
  chunk_id: string;
  external_chunk_id: string;
  document_id: string;
  knowledge_document_id: string;
  document_title: string;
  text: string;
  chunk_index: number;
  total_chunks: number;
  page_number: number | null;
  section: string | null;
  category: string;
  sub_category: string | null;
  source_file: string;
  content_hash: string;
  score: number;
}

/** Vectors stored per embedding provider and model (indexed documents only). */
export interface StoredEmbeddingSpace {
  provider: string;
  model: string;
  vectors: number;
}

/** The stored-vector summary changes only when the library is (re)indexed. */
const SPACES_CACHE_MS = 60_000;

@Injectable()
export class ChunkSearchRepository {
  private spacesCache?: { at: number; value: StoredEmbeddingSpace[] };
  private iterativeScanSupported?: boolean;

  constructor(private readonly prisma: PrismaService) {}

  async storedEmbeddingSpaces(): Promise<StoredEmbeddingSpace[]> {
    if (
      this.spacesCache &&
      Date.now() - this.spacesCache.at < SPACES_CACHE_MS
    ) {
      return this.spacesCache.value;
    }
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ provider: string; model: string; vectors: bigint | number }>
    >(`
      SELECT ce.provider, ce.model, count(*) AS vectors
      FROM vectors.chunk_embeddings ce
      INNER JOIN documents.document_chunks dc ON dc.id = ce.chunk_id
      INNER JOIN documents.indexed_documents id ON id.id = dc.document_id
      WHERE id.status = 'indexed'
      GROUP BY ce.provider, ce.model
    `);
    const value = rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      vectors: Number(row.vectors),
    }));
    this.spacesCache = { at: Date.now(), value };
    return value;
  }

  /**
   * Nearest passages by cosine similarity, among vectors made by the query's
   * embedding model only: vectors from another model are not comparable,
   * even when they have the same number of dimensions.
   */
  async searchByVector(
    embedding: number[],
    space: EmbeddingSpace,
    filters: RetrievalFilters,
    limit: number,
    minSimilarity: number,
    efSearch: number,
  ): Promise<ChunkSearchRow[]> {
    const { clause, params } = buildFilterClauses(filters);
    const vectorParam = toVectorLiteral(embedding);
    const n = params.length;
    const limitIdx = n + 1;
    const vectorIdx = n + 2;
    const minSimIdx = n + 3;
    const providerIdx = n + 4;
    const modelsIdx = n + 5;

    const sql = `
      SELECT
        dc.id AS chunk_id,
        dc.external_chunk_id,
        dc.document_id,
        id.knowledge_document_id,
        id.document_title,
        dc.text,
        dc.chunk_index,
        dc.total_chunks,
        dc.page_number,
        dc.section,
        id.category,
        id.sub_category,
        id.source_file,
        dc.content_hash,
        (1 - (ce.embedding <=> $${vectorIdx}::vector))::float AS score
      FROM vectors.chunk_embeddings ce
      INNER JOIN documents.document_chunks dc ON dc.id = ce.chunk_id
      INNER JOIN documents.indexed_documents id ON id.id = dc.document_id
      WHERE ${clause}
        AND ce.provider = $${providerIdx}
        AND ce.model = ANY($${modelsIdx}::text[])
        AND (1 - (ce.embedding <=> $${vectorIdx}::vector)) >= $${minSimIdx}
      ORDER BY ce.embedding <=> $${vectorIdx}::vector
      LIMIT $${limitIdx}
    `;

    const iterative = await this.supportsIterativeScan();
    return this.prisma.$transaction(
      async (tx) => {
        // The HNSW index returns ef_search candidates before the filters
        // above apply; iterative scans (pgvector 0.8+) keep looking when
        // filters remove too many.
        await tx.$queryRawUnsafe(
          `SELECT set_config('hnsw.ef_search', $1, true)`,
          String(Math.max(efSearch, limit)),
        );
        if (iterative) {
          await tx.$queryRawUnsafe(
            `SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`,
          );
        }
        const rows = await tx.$queryRawUnsafe<ChunkSearchRow[]>(
          sql,
          ...params,
          limit,
          vectorParam,
          minSimilarity,
          space.provider,
          space.models,
        );
        // relaxed_order can return near neighbours slightly out of order.
        return rows.sort((a, b) => Number(b.score) - Number(a.score));
      },
      { timeout: 15_000 },
    );
  }

  /**
   * Passages containing any of the query's medical terms, ranked by how many
   * terms they contain and how close together (ts_rank_cd, scaled to 0–1).
   */
  async searchByKeyword(
    keywordQuery: string,
    filters: RetrievalFilters,
    limit: number,
  ): Promise<ChunkSearchRow[]> {
    if (!keywordQuery.trim()) return [];
    const { clause, params } = buildFilterClauses(filters);
    const n = params.length;
    const queryIdx = n + 1;
    const limitIdx = n + 2;

    const sql = `
      WITH q AS (SELECT websearch_to_tsquery('english', $${queryIdx}) AS query)
      SELECT
        dc.id AS chunk_id,
        dc.external_chunk_id,
        dc.document_id,
        id.knowledge_document_id,
        id.document_title,
        dc.text,
        dc.chunk_index,
        dc.total_chunks,
        dc.page_number,
        dc.section,
        id.category,
        id.sub_category,
        id.source_file,
        dc.content_hash,
        ts_rank_cd(to_tsvector('english', dc.text), q.query, 32)::float AS score
      FROM documents.document_chunks dc
      INNER JOIN documents.indexed_documents id ON id.id = dc.document_id
      CROSS JOIN q
      WHERE ${clause}
        AND to_tsvector('english', dc.text) @@ q.query
      ORDER BY score DESC
      LIMIT $${limitIdx}
    `;

    return this.prisma.$queryRawUnsafe<ChunkSearchRow[]>(
      sql,
      ...params,
      keywordQuery,
      limit,
    );
  }

  private async supportsIterativeScan(): Promise<boolean> {
    if (this.iterativeScanSupported !== undefined) {
      return this.iterativeScanSupported;
    }
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ extversion: string }>
    >(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    const [major, minor] = (rows[0]?.extversion ?? '0.0')
      .split('.')
      .map(Number);
    this.iterativeScanSupported = major > 0 || minor >= 8;
    return this.iterativeScanSupported;
  }
}
