import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { KnowledgeBaseModule } from '@modules/knowledge-base/knowledge-base.module';
import { ParserFactory } from './parsers/parser.factory';
import { DocumentProcessingService } from './services/document-processing.service';
import { OcrService } from './ocr/ocr.service';
import { MockOcrProvider } from './ocr/mock-ocr.provider';
import { DisabledOcrProvider } from './ocr/disabled-ocr.provider';

@Module({
  imports: [AppConfigModule, KnowledgeBaseModule],
  providers: [
    ParserFactory,
    DocumentProcessingService,
    OcrService,
    MockOcrProvider,
    DisabledOcrProvider,
  ],
  exports: [
    DocumentProcessingService,
    ParserFactory,
    OcrService,
    MockOcrProvider,
  ],
})
export class DocumentProcessingModule {}
