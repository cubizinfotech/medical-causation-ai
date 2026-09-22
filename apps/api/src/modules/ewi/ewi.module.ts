import { Module } from '@nestjs/common';
import { EwiInvestigationModule } from './investigation/ewi-investigation.module';

/**
 * EWI product boundary — Expert Witness Investigation.
 */
@Module({
  imports: [EwiInvestigationModule],
  exports: [EwiInvestigationModule],
})
export class EwiModule {}
