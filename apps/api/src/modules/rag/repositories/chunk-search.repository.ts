import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { buildFilterClauses, toVectorLiteral } from '../utils';
import type { RetrievalFilters } from '../types';

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

@Injectable()
export class ChunkSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchByVector(
    embedding: number[],
    filters: RetrievalFilters,
    limit: number,
    minSimilarity: number,
  ): Promise<ChunkSearchRow[]> {
    const { clause, params } = buildFilterClauses(filters);
    const vectorParam = toVectorLiteral(embedding);
    const n = params.length;
    const limitIdx = n + 1;
    const vectorIdx = n + 2;
    const minSimIdx = n + 3;

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
        AND (1 - (ce.embedding <=> $${vectorIdx}::vector)) >= $${minSimIdx}
      ORDER BY ce.embedding <=> $${vectorIdx}::vector
      LIMIT $${limitIdx}
    `;

    return this.prisma.$queryRawUnsafe<ChunkSearchRow[]>(
      sql,
      ...params,
      limit,
      vectorParam,
      minSimilarity,
    );
  }

  async searchByKeyword(
    queryText: string,
    filters: RetrievalFilters,
    limit: number,
  ): Promise<ChunkSearchRow[]> {
    const { clause, params } = buildFilterClauses(filters);
    const n = params.length;
    const queryIdx = n + 1;
    const limitIdx = n + 2;

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
        ts_rank(
          to_tsvector('english', dc.text),
          plainto_tsquery('english', $${queryIdx})
        )::float AS score
      FROM documents.document_chunks dc
      INNER JOIN documents.indexed_documents id ON id.id = dc.document_id
      WHERE ${clause}
        AND to_tsvector('english', dc.text) @@ plainto_tsquery('english', $${queryIdx})
      ORDER BY score DESC
      LIMIT $${limitIdx}
    `;

    return this.prisma.$queryRawUnsafe<ChunkSearchRow[]>(
      sql,
      ...params,
      queryText,
      limit,
    );
  }
}
