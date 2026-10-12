import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { AuditModule } from '@platform/audit/audit.module';
import { DocumentProcessingModule } from '@modules/document-processing';
import { PdfPageOcr } from '@modules/document-processing/ocr/pdf-page-ocr';
import { EwiDocumentIntakeService } from './ewi-document-intake.service';
import { EwiReportReferenceService } from './ewi-report-reference.service';
import { ExpertDocumentsController } from './expert-documents.controller';
import { ExpertDocumentsService } from './expert-documents.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Module({
  imports: [DatabaseModule, AuditModule, DocumentProcessingModule],
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
export class EwiDocumentsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EwiDocumentsModule.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly documents: ExpertDocumentsService) {}

  onModuleInit(): void {
    // Uploads that never became part of an investigation: now, then hourly.
    const cleanup = () =>
      void this.documents.cleanupStaged().catch((error: unknown) => {
        this.logger.warn(
          `Staged document cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    cleanup();
    this.cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
