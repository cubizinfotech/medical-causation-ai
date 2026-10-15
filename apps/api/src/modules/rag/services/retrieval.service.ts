import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@ai/services';
import { describeError, sameEmbeddingModel } from '@ai/utils';
import type { RagConfigSettings } from '@config/config.types';
import { KNOWLEDGE_SOURCE_TYPES } from '../constants';
import type { IRetrievalService } from '../interfaces';
import type {
  EmbeddingSpace,
  RetrievalCoverage,
  RetrievalRequest,
  RetrievalResult,
  RetrievedChunk,
  VectorSearchSkipReason,
} from '../types';
import { ContextBuilder } from '../builders';
import { RetrieverRegistry } from '../retrievers';
import { RerankerRegistry } from '../rerankers';
import { ChunkSearchRepository } from '../repositories';
import { buildKeywordSearchQuery, buildQueryText } from '../utils';
import { RetrievalLoggingService } from './retrieval-logging.service';

/** A search query waits on this call; indexing keeps its longer retry policy. */
const QUERY_EMBED_ATTEMPTS = 2;
const MISMATCH_WARNING_INTERVAL_MS = 10 * 60_000;

/**
 * Cosine similarity at which a passage is about the case's topic. Models
 * score very differently, so each family has its own value, measured on this
 * library at 768 dimensions with case-style queries:
 * - gemini-embedding-2: passages on the case's causal question 0.77–0.81;
 *   passages on a neighbouring topic (impairment rating of the same
 *   condition, other conditions) 0.69–0.74.
 * - text-embedding-3-small: on-topic 0.52–0.61; off-topic at most 0.38.
 * RAG_RELEVANCE_MIN_SIMILARITY overrides these.
 */
export function defaultRelevanceThreshold(model: string): number {
  const name = model.toLowerCase();
  if (
    name.includes('gemini-embedding') ||
    name.includes('text-embedding-004')
  ) {
    return 0.75;
  }
  if (name.includes('text-embedding-3')) return 0.45;
  return 0.5;
}

interface QueryVector {
  provider: string;
  model: string;
  embedding?: number[];
  space?: EmbeddingSpace;
  skipReason?: VectorSearchSkipReason;
}

/**
 * RAG retrieval entry point — retrieves, ranks, and prepares context.
 * Does NOT generate medical reports or perform reasoning.
 */
@Injectable()
export class RetrievalService implements IRetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private lastMismatchWarningAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly retrieverRegistry: RetrieverRegistry,
    private readonly rerankerRegistry: RerankerRegistry,
    private readonly contextBuilder: ContextBuilder,
    private readonly loggingService: RetrievalLoggingService,
    private readonly chunkSearch: ChunkSearchRepository,
  ) {}

  private get config(): RagConfigSettings {
    return this.configService.get<RagConfigSettings>('rag')!;
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const startTime = Date.now();
    const topK = request.topK ?? this.config.topK;

    const queryText = buildQueryText({
      question: request.question,
      patientInformation: request.patientInformation,
      injury: request.injury,
      diagnosis: request.diagnosis,
      symptoms: request.symptoms,
      medicalHistory: request.medicalHistory,
      conversationContext: request.conversationContext,
    });
    const keywordQuery = buildKeywordSearchQuery({
      question: request.question,
      injury: request.injury,
      diagnosis: request.diagnosis,
      symptoms: request.symptoms,
    });

    this.logger.debug(`Retrieval query built (${queryText.length} chars)`);

    const vector = await this.embedQuery(queryText);

    const filters = request.filters ?? {};
    const sources = filters.sources ?? [KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB];
    const retrievers = this.retrieverRegistry.getActiveRetrievers(sources);

    const retrievalQuery = {
      queryText,
      keywordQuery,
      embedding: vector.embedding,
      embeddingSpace: vector.space,
      filters,
      topK: topK * 2,
    };

    const chunkSets = await Promise.all(
      retrievers.map((retriever) => retriever.retrieve(retrievalQuery)),
    );

    const allChunks = chunkSets.flat();

    const reranker = this.rerankerRegistry.getReranker(
      this.config.defaultReranker,
    );
    const rankedChunks = await reranker.rerank(queryText, allChunks, topK);
    const coverage = this.assessCoverage(rankedChunks, vector);

    const context = this.contextBuilder.build(
      rankedChunks,
      this.config.maxContextTokens,
    );

    const executionTimeMs = Date.now() - startTime;
    const fingerprint = this.loggingService.createQuestionFingerprint(
      request.question,
    );

    this.loggingService.log({
      ...fingerprint,
      retrievedDocumentIds: [...new Set(rankedChunks.map((c) => c.documentId))],
      retrievedChunkIds: rankedChunks.map((c) => c.chunkId),
      chunkCount: rankedChunks.length,
      executionTimeMs,
      embeddingProvider: vector.provider,
      embeddingModel: vector.model,
      estimatedContextTokens: context.estimatedTokens,
      strategy: request.strategy ?? 'hybrid',
      reranker: reranker.name,
      searchMode: coverage.searchMode,
      relevantChunkCount: coverage.relevantChunkCount,
      topSimilarity: coverage.topSimilarity,
    });

    return {
      question: request.question,
      chunks: rankedChunks,
      context,
      executionTimeMs,
      embeddingProvider: vector.provider,
      embeddingModel: vector.model,
      strategy: request.strategy ?? 'hybrid',
      reranker: reranker.name,
      coverage,
    };
  }

  /**
   * Embeds the query only when the library holds vectors from the same
   * model; otherwise the call would cost money and match nothing. A failed
   * embedding leaves keyword search running instead of failing the request.
   */
  private async embedQuery(queryText: string): Promise<QueryVector> {
    let target: { provider: string; model: string };
    try {
      target = this.aiService.getActiveEmbeddingTarget();
    } catch (error) {
      this.logger.warn(
        `Embedding provider is not usable (${describeError(error)}); searching the library by keyword only`,
      );
      return {
        provider: 'none',
        model: 'none',
        skipReason: 'embedding_failed',
      };
    }

    const stored = await this.chunkSearch.storedEmbeddingSpaces();
    if (stored.length === 0) {
      return { ...target, skipReason: 'no_vectors' };
    }
    const matching = stored.filter(
      (space) =>
        space.provider === target.provider &&
        sameEmbeddingModel(space.model, target.model),
    );
    if (matching.length === 0) {
      this.warnModelMismatch(stored, target);
      return { ...target, skipReason: 'model_mismatch' };
    }

    try {
      const response = await this.aiService.embed({
        inputs: [{ text: queryText }],
        maxAttempts: QUERY_EMBED_ATTEMPTS,
      });
      const embedding = response.results[0]?.embedding;
      if (!embedding?.length) {
        throw new Error('the provider returned an empty query embedding');
      }
      return {
        provider: response.provider,
        model: response.model,
        embedding,
        space: {
          provider: target.provider,
          models: matching.map((space) => space.model),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Query embedding failed (${describeError(error)}); searching the library by keyword only`,
      );
      return { ...target, skipReason: 'embedding_failed' };
    }
  }

  private assessCoverage(
    chunks: RetrievedChunk[],
    vector: QueryVector,
  ): RetrievalCoverage {
    const relevanceThreshold =
      this.config.relevanceMinSimilarity ??
      defaultRelevanceThreshold(vector.model);
    let relevantChunkCount = 0;
    let topSimilarity = 0;
    for (const chunk of chunks) {
      topSimilarity = Math.max(topSimilarity, chunk.vectorScore);
      // Keyword matches alone do not show a passage is on topic.
      chunk.relevant =
        vector.embedding !== undefined &&
        chunk.vectorScore >= relevanceThreshold;
      if (chunk.relevant) relevantChunkCount++;
    }
    return {
      searchMode: vector.embedding ? 'hybrid' : 'keyword_only',
      ...(vector.skipReason ? { vectorSkipReason: vector.skipReason } : {}),
      relevantChunkCount,
      topSimilarity: Number(topSimilarity.toFixed(4)),
      relevanceThreshold,
      sufficient: relevantChunkCount >= this.config.minRelevantChunks,
    };
  }

  private warnModelMismatch(
    stored: Array<{ provider: string; model: string; vectors: number }>,
    target: { provider: string; model: string },
  ): void {
    if (
      Date.now() - this.lastMismatchWarningAt <
      MISMATCH_WARNING_INTERVAL_MS
    ) {
      return;
    }
    this.lastMismatchWarningAt = Date.now();
    const found = stored
      .map((space) => `${space.provider}/${space.model} (${space.vectors})`)
      .join(', ');
    this.logger.warn(
      `Library vectors were made with ${found}, but queries use ${target.provider}/${target.model}. ` +
        'Vector search is skipped (keyword search still runs) until the library is re-embedded: npm run reembed:kb',
    );
  }
}
