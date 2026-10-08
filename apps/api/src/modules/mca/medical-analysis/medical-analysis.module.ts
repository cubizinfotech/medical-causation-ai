import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { RagModule } from '@modules/rag/rag.module';
import { RedisModule } from '@redis/redis.module';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@platform/auth/auth.module';
import { MedicalLiteratureModule } from '@integrations/medical-literature';
import { MedicalPromptService } from './prompts';
import { AnalysisPromptBuilder, MedicalQueryBuilder } from './builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from './validators';
import { ReportEnrichmentService } from './services/report-enrichment.service';
import { CaseLiteratureService } from './services/case-literature.service';
import { CaseRecordsController } from './records/case-records.controller';
import { CaseRecordsService } from './records/case-records.service';
import { ChronologyExtractionService } from './records/chronology-extraction.service';
import { AnalysisHistoryService } from './services/analysis-history.service';
import { MedicalAnalysisService } from './services/medical-analysis.service';
import { MedicalAnalysisController } from './controllers';
import { MedicalAnalysisGateway } from './gateway/medical-analysis.gateway';
import { MedicalAnalysisJobService } from './jobs/medical-analysis-job.service';
import { MedicalAnalysisProcessor } from './jobs/medical-analysis.processor';
import { AnalysisCaseRepository } from './repositories/analysis-case.repository';

@Module({
  imports: [
    AiModule,
    RagModule,
    RedisModule,
    DatabaseModule,
    AuthModule,
    MedicalLiteratureModule,
  ],
  controllers: [MedicalAnalysisController, CaseRecordsController],
  providers: [
    MedicalPromptService,
    MedicalQueryBuilder,
    AnalysisPromptBuilder,
    AnalysisSafetyValidator,
    AnalysisResponseMapper,
    ReportEnrichmentService,
    CaseLiteratureService,
    CaseRecordsService,
    ChronologyExtractionService,
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
  private readonly logger = new Logger(MedicalAnalysisModule.name);

  constructor(
    private readonly gateway: MedicalAnalysisGateway,
    private readonly jobService: MedicalAnalysisJobService,
    private readonly historyService: AnalysisHistoryService,
    private readonly caseRecords: CaseRecordsService,
  ) {}

  onModuleInit(): void {
    this.jobService.setGateway(this.gateway);
    // Uploads that never became part of an analysis (patient data).
    void this.caseRecords.cleanupStaged().catch((error: unknown) => {
      this.logger.warn(
        `Staged record cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.historyService.reconcileStaleCases().then((count) => {
      if (count > 0) {
        this.logger.warn(
          `Reconciled ${count} stale analysis history record(s)`,
        );
      }
    });
  }
}
