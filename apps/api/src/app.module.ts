import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { AiModule } from '@ai/ai.module';
import { KnowledgeBaseModule } from '@modules/knowledge-base/knowledge-base.module';
import { DocumentProcessingModule } from '@modules/document-processing/document-processing.module';
import { IndexingModule } from '@modules/indexing/indexing.module';
import { RagModule } from '@modules/rag/rag.module';
import { MedicalAnalysisModule } from '@modules/medical-analysis/medical-analysis.module';
import { DatabaseModule } from '@database/database.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AiModule,
    KnowledgeBaseModule,
    DocumentProcessingModule,
    IndexingModule,
    RagModule,
    MedicalAnalysisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
