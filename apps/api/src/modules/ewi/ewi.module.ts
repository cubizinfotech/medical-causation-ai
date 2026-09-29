import { Module } from '@nestjs/common';
import { EwiCorrespondenceModule } from './correspondence/ewi-correspondence.module';
import { EwiInvestigationModule } from './investigation/ewi-investigation.module';
import { EwiDocumentsModule } from './documents/ewi-documents.module';

/**
 * EWI product boundary — Expert Witness Investigation.
 */
@Module({
  imports: [
    EwiInvestigationModule,
    EwiCorrespondenceModule,
    EwiDocumentsModule,
  ],
  exports: [
    EwiInvestigationModule,
    EwiCorrespondenceModule,
    EwiDocumentsModule,
  ],
})
export class EwiModule {}
