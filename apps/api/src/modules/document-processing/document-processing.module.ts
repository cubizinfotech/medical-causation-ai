import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { KnowledgeBaseModule } from '@modules/knowledge-base/knowledge-base.module';
import { ParserFactory } from './parsers/parser.factory';
import { DocumentProcessingService } from './services/document-processing.service';

@Module({
  imports: [AppConfigModule, KnowledgeBaseModule],
  providers: [ParserFactory, DocumentProcessingService],
  exports: [DocumentProcessingService, ParserFactory],
})
export class DocumentProcessingModule {}
