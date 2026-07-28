import type { RetrievalQuery, RetrievedChunk } from '../types';
import type { KnowledgeSourceType } from '../constants';

/**
 * Contract for knowledge source retrievers.
 * New sources (PubMed, PMC, etc.) implement this interface only.
 */
export interface IKnowledgeRetriever {
  readonly sourceType: KnowledgeSourceType;

  retrieve(query: RetrievalQuery): Promise<RetrievedChunk[]>;
}

export interface IReranker {
  readonly name: string;

  rerank(
    queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]>;
}

export interface IContextBuilder {
  build(
    chunks: RetrievedChunk[],
    maxTokens: number,
  ): import('../types').BuiltContext;
}

export interface ICitationManager {
  buildCitation(
    chunk: Omit<RetrievedChunk, 'citation'>,
  ): import('../types').ChunkCitation;
}

export interface IRetrievalService {
  retrieve(
    request: import('../types').RetrievalRequest,
  ): Promise<import('../types').RetrievalResult>;
}
