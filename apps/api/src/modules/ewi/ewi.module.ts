import { Module } from '@nestjs/common';
import { EwiCorrespondenceModule } from './correspondence/ewi-correspondence.module';
import { EwiInvestigationModule } from './investigation/ewi-investigation.module';

/**
 * EWI product boundary — Expert Witness Investigation.
 */
@Module({
  imports: [EwiInvestigationModule, EwiCorrespondenceModule],
  exports: [EwiInvestigationModule, EwiCorrespondenceModule],
})
export class EwiModule {}
