import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@ai/services';
import { AiConfigService } from '@ai/config';
import type { RagConfigSettings } from '@config/config.types';
import { KNOWLEDGE_SOURCE_TYPES } from '../constants';
import type { IRetrievalService } from '../interfaces';
import type { RetrievalRequest, RetrievalResult } from '../types';
import { ContextBuilder } from '../builders';
import { RetrieverRegistry } from '../retrievers';
import { RerankerRegistry } from '../rerankers';
import { buildQueryText } from '../utils';
import { RetrievalLoggingService } from './retrieval-logging.service';

/**
 * RAG retrieval entry point — retrieves, ranks, and prepares context.
 * Does NOT generate medical reports or perform reasoning.
 */
@Injectable()
export class RetrievalService implements IRetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly aiConfigService: AiConfigService,
    private readonly retrieverRegistry: RetrieverRegistry,
    private readonly rerankerRegistry: RerankerRegistry,
    private readonly contextBuilder: ContextBuilder,
    private readonly loggingService: RetrievalLoggingService,
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

    this.logger.debug(`Retrieval query built (${queryText.length} chars)`);

    const embeddingResponse = await this.aiService.embed({
      inputs: [{ text: queryText }],
    });

    const queryEmbedding = embeddingResponse.results[0]?.embedding;
    if (!queryEmbedding?.length) {
      throw new Error('Failed to generate query embedding');
    }

    const filters = request.filters ?? {};
    const sources = filters.sources ?? [KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB];
    const retrievers = this.retrieverRegistry.getActiveRetrievers(sources);

    const retrievalQuery = {
      queryText,
      embedding: queryEmbedding,
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
      embeddingProvider: embeddingResponse.provider,
      embeddingModel: embeddingResponse.model,
      estimatedContextTokens: context.estimatedTokens,
      strategy: request.strategy ?? 'hybrid',
      reranker: reranker.name,
    });

    return {
      question: request.question,
      chunks: rankedChunks,
      context,
      executionTimeMs,
      embeddingProvider: embeddingResponse.provider,
      embeddingModel: embeddingResponse.model,
      strategy: request.strategy ?? 'hybrid',
      reranker: reranker.name,
    };
  }
}
