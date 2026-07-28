import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { AiModule } from '@ai/ai.module';
import { KnowledgeBaseModule } from '@modules/knowledge-base/knowledge-base.module';
import { DocumentProcessingModule } from '@modules/document-processing/document-processing.module';
import { ChunkingService } from './chunking/chunking.service';
import { IndexingEmbeddingService } from './embeddings/indexing-embedding.service';
import {
  DocumentChunkRepository,
  EmbeddingRepository,
  IndexedDocumentRepository,
} from './repositories';
import {
  IndexingJobService,
  IndexingService,
  IndexingStatsService,
} from './services';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    KnowledgeBaseModule,
    DocumentProcessingModule,
  ],
  providers: [
    ChunkingService,
    IndexingEmbeddingService,
    IndexedDocumentRepository,
    DocumentChunkRepository,
    EmbeddingRepository,
    IndexingService,
    IndexingStatsService,
    IndexingJobService,
  ],
  exports: [
    IndexingService,
    IndexingStatsService,
    IndexingJobService,
    ChunkingService,
  ],
})
export class IndexingModule {}
