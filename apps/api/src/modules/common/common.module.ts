import { Module } from '@nestjs/common';
import { KnowledgeBaseModule } from '@modules/knowledge-base/knowledge-base.module';
import { DocumentProcessingModule } from '@modules/document-processing/document-processing.module';
import { IndexingModule } from '@modules/indexing/indexing.module';
import { RagModule } from '@modules/rag/rag.module';

/**
 * Shared document/RAG Nest modules used by MCA (and optionally EWI).
 *
 * Implementations stay in modules/knowledge-base|document-processing|indexing|rag
 * so imports and tests remain stable. This facade makes the Common boundary explicit
 * for future extraction into packages/ or a platform service.
 */
@Module({
  imports: [
    KnowledgeBaseModule,
    DocumentProcessingModule,
    IndexingModule,
    RagModule,
  ],
  exports: [
    KnowledgeBaseModule,
    DocumentProcessingModule,
    IndexingModule,
    RagModule,
  ],
})
export class CommonModule {}
