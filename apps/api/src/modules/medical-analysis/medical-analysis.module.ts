import { Module } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { RagModule } from '@modules/rag/rag.module';
import { MedicalPromptService } from './prompts';
import { AnalysisPromptBuilder, MedicalQueryBuilder } from './builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from './validators';
import { ReportEnrichmentService } from './services/report-enrichment.service';
import { MedicalAnalysisService } from './services/medical-analysis.service';
import { MedicalAnalysisController } from './controllers';

@Module({
  imports: [AiModule, RagModule],
  controllers: [MedicalAnalysisController],
  providers: [
    MedicalPromptService,
    MedicalQueryBuilder,
    AnalysisPromptBuilder,
    AnalysisSafetyValidator,
    AnalysisResponseMapper,
    ReportEnrichmentService,
    MedicalAnalysisService,
  ],
  exports: [MedicalAnalysisService],
})
export class MedicalAnalysisModule {}
