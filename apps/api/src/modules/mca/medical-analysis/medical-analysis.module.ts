import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { RagModule } from '@modules/rag/rag.module';
import { RedisModule } from '@redis/redis.module';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@platform/auth/auth.module';
import { AuditModule } from '@platform/audit/audit.module';
import { MedicalLiteratureModule } from '@integrations/medical-literature';
import { MedicalPromptService } from './prompts';
import { AnalysisPromptBuilder, MedicalQueryBuilder } from './builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from './validators';
import { ReportEnrichmentService } from './services/report-enrichment.service';
import { CaseLiteratureService } from './services/case-literature.service';
import { CaseRecordsController } from './records/case-records.controller';
import { CaseRecordsService } from './records/case-records.service';
import { PdfPageOcr } from '@modules/document-processing/ocr/pdf-page-ocr';
import { ChronologyExtractionService } from './records/chronology-extraction.service';
import { BillingExtractionService } from './records/billing-extraction.service';
import { AnalysisHistoryService } from './services/analysis-history.service';
import { MedicalAnalysisService } from './services/medical-analysis.service';
import { MedicalAnalysisController } from './controllers';
import { MedicalAnalysisGateway } from './gateway/medical-analysis.gateway';
import { MedicalAnalysisJobService } from './jobs/medical-analysis-job.service';
import { MedicalAnalysisProcessor } from './jobs/medical-analysis.processor';
import { AnalysisCaseRepository } from './repositories/analysis-case.repository';
import { DemandLetterController } from './demand-letter/demand-letter.controller';
import { DemandLetterService } from './demand-letter/demand-letter.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Module({
  imports: [
    AiModule,
    RagModule,
    RedisModule,
    DatabaseModule,
    AuthModule,
    AuditModule,
    MedicalLiteratureModule,
  ],
  controllers: [
    MedicalAnalysisController,
    CaseRecordsController,
    DemandLetterController,
  ],
  providers: [
    MedicalPromptService,
    MedicalQueryBuilder,
    AnalysisPromptBuilder,
    AnalysisSafetyValidator,
    AnalysisResponseMapper,
    ReportEnrichmentService,
    CaseLiteratureService,
    CaseRecordsService,
    PdfPageOcr,
    ChronologyExtractionService,
    BillingExtractionService,
    DemandLetterService,
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
export class MedicalAnalysisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicalAnalysisModule.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly gateway: MedicalAnalysisGateway,
    private readonly jobService: MedicalAnalysisJobService,
    private readonly historyService: AnalysisHistoryService,
    private readonly caseRecords: CaseRecordsService,
  ) {}

  onModuleInit(): void {
    this.jobService.setGateway(this.gateway);
    // Uploads that never became part of an analysis (patient data): now,
    // then hourly.
    const cleanup = () =>
      void this.caseRecords.cleanupStaged().catch((error: unknown) => {
        this.logger.warn(
          `Staged record cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    cleanup();
    this.cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();
    void this.historyService.reconcileStaleCases().then((count) => {
      if (count > 0) {
        this.logger.warn(
          `Reconciled ${count} stale analysis history record(s)`,
        );
      }
    });
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
