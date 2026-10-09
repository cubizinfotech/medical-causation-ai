import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { DocumentProcessingModule } from '@modules/document-processing';
import { PdfPageOcr } from '@modules/document-processing/ocr/pdf-page-ocr';
import { EwiDocumentIntakeService } from './ewi-document-intake.service';
import { EwiReportReferenceService } from './ewi-report-reference.service';
import { ExpertDocumentsController } from './expert-documents.controller';
import { ExpertDocumentsService } from './expert-documents.service';

@Module({
  imports: [DatabaseModule, DocumentProcessingModule],
  controllers: [ExpertDocumentsController],
  providers: [
    EwiDocumentIntakeService,
    EwiReportReferenceService,
    ExpertDocumentsService,
    PdfPageOcr,
  ],
  exports: [
    EwiDocumentIntakeService,
    EwiReportReferenceService,
    ExpertDocumentsService,
  ],
})
export class EwiDocumentsModule {}
