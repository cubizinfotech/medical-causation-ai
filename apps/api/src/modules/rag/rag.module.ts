import { Module } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { DatabaseModule } from '@database/database.module';
import { CitationManager, ContextBuilder } from './builders';
import { ChunkSearchRepository } from './repositories';
import {
  HybridKnowledgeBaseRetriever,
  KeywordRetriever,
  RetrieverRegistry,
  VectorRetriever,
} from './retrievers';
import {
  BgeReranker,
  CohereReranker,
  CrossEncoderReranker,
  JinaReranker,
  RerankerRegistry,
  ScoreBasedReranker,
} from './rerankers';
import { RetrievalLoggingService, RetrievalService } from './services';

@Module({
  imports: [DatabaseModule, AiModule],
  providers: [
    ChunkSearchRepository,
    CitationManager,
    ContextBuilder,
    VectorRetriever,
    KeywordRetriever,
    HybridKnowledgeBaseRetriever,
    RetrieverRegistry,
    ScoreBasedReranker,
    CrossEncoderReranker,
    CohereReranker,
    JinaReranker,
    BgeReranker,
    RerankerRegistry,
    RetrievalLoggingService,
    RetrievalService,
  ],
  exports: [RetrievalService, RetrievalLoggingService],
})
export class RagModule {}
