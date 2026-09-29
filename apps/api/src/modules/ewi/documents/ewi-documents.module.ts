import { Module } from '@nestjs/common';
import { DocumentProcessingModule } from '@modules/document-processing';
import { EwiDocumentIntakeService } from './ewi-document-intake.service';
import { EwiReportReferenceService } from './ewi-report-reference.service';

@Module({
  imports: [DocumentProcessingModule],
  providers: [EwiDocumentIntakeService, EwiReportReferenceService],
  exports: [EwiDocumentIntakeService, EwiReportReferenceService],
})
export class EwiDocumentsModule {}
