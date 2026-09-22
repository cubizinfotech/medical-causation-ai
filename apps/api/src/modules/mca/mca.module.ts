import { Module } from '@nestjs/common';
import { MedicalAnalysisModule } from './medical-analysis/medical-analysis.module';

/**
 * MCA product boundary — Medical Causation Analysis.
 * Domain modules for MCA live under modules/mca/.
 */
@Module({
  imports: [MedicalAnalysisModule],
  exports: [MedicalAnalysisModule],
})
export class McaModule {}
