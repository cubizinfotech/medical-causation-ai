import { Injectable } from '@nestjs/common';
import type { IReranker } from '../interfaces';
import type { RetrievedChunk } from '../types';
import { RERANKER_TYPES } from '../constants';

/**
 * Default re-ranker using combined hybrid search scores.
 */
@Injectable()
export class ScoreBasedReranker implements IReranker {
  readonly name = RERANKER_TYPES.SCORE;

  rerank(
    _queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const ranked = [...chunks]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);

    return Promise.resolve(ranked);
  }
}

/** @future Cross-encoder re-ranking */
@Injectable()
export class CrossEncoderReranker implements IReranker {
  readonly name = RERANKER_TYPES.CROSS_ENCODER;

  rerank(
    _queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks.slice(0, topK));
  }
}

/** @future Cohere Rerank API */
@Injectable()
export class CohereReranker implements IReranker {
  readonly name = RERANKER_TYPES.COHERE;

  rerank(
    _queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks.slice(0, topK));
  }
}

/** @future Jina Reranker API */
@Injectable()
export class JinaReranker implements IReranker {
  readonly name = RERANKER_TYPES.JINA;

  rerank(
    _queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks.slice(0, topK));
  }
}

/** @future BGE Reranker */
@Injectable()
export class BgeReranker implements IReranker {
  readonly name = RERANKER_TYPES.BGE;

  rerank(
    _queryText: string,
    chunks: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks.slice(0, topK));
  }
}

@Injectable()
export class RerankerRegistry {
  private readonly rerankers: Map<string, IReranker>;

  constructor(scoreReranker: ScoreBasedReranker) {
    this.rerankers = new Map([[RERANKER_TYPES.SCORE, scoreReranker]]);
  }

  getReranker(name: string): IReranker {
    return (
      this.rerankers.get(name) ?? this.rerankers.get(RERANKER_TYPES.SCORE)!
    );
  }
}
