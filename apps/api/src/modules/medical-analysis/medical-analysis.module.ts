import { Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { RagModule } from '@modules/rag/rag.module';
import { RedisModule } from '../../redis/redis.module';
import { DatabaseModule } from '@database/database.module';
import { MedicalPromptService } from './prompts';
import { AnalysisPromptBuilder, MedicalQueryBuilder } from './builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from './validators';
import { ReportEnrichmentService } from './services/report-enrichment.service';
import { MedicalAnalysisService } from './services/medical-analysis.service';
import { MedicalAnalysisController } from './controllers';
import { MedicalAnalysisGateway } from './gateway/medical-analysis.gateway';
import { MedicalAnalysisJobService } from './jobs/medical-analysis-job.service';
import { MedicalAnalysisProcessor } from './jobs/medical-analysis.processor';
import { AnalysisHistoryService } from './services/analysis-history.service';
import { AnalysisCaseRepository } from './repositories/analysis-case.repository';

@Module({
  imports: [AiModule, RagModule, RedisModule, DatabaseModule],
  controllers: [MedicalAnalysisController],
  providers: [
    MedicalPromptService,
    MedicalQueryBuilder,
    AnalysisPromptBuilder,
    AnalysisSafetyValidator,
    AnalysisResponseMapper,
    ReportEnrichmentService,
    MedicalAnalysisService,
    AnalysisCaseRepository,
    AnalysisHistoryService,
    MedicalAnalysisJobService,
    MedicalAnalysisProcessor,
    MedicalAnalysisGateway,
  ],
  exports: [
    MedicalAnalysisService,
    MedicalAnalysisJobService,
    AnalysisHistoryService,
  ],
})
export class MedicalAnalysisModule implements OnModuleInit {
  constructor(
    private readonly gateway: MedicalAnalysisGateway,
    private readonly jobService: MedicalAnalysisJobService,
  ) {}

  onModuleInit(): void {
    this.jobService.setGateway(this.gateway);
  }
}
