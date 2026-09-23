import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { RedisModule } from '@redis/redis.module';
import { DatabaseModule } from '@database/database.module';
import { AiModule } from '@ai/ai.module';
import { ReportModule } from '@platform/report/report.module';
import { ExpertResearchIntegrationsModule } from '@integrations/expert-research';
import { ExpertResearchOrchestrator } from '../research/expert-research.orchestrator';
import { EwiWordReportService } from '../report/ewi-word-report.service';
import { EwiAnalysisService } from './analysis/ewi-analysis.service';
import { ExpertInvestigationRepository } from './repositories/expert-investigation.repository';
import { InvestigationHistoryService } from './services/investigation-history.service';
import { ExpertInvestigationService } from './services/expert-investigation.service';
import { EwiInvestigationJobService } from './jobs/ewi-investigation-job.service';
import { EwiInvestigationProcessor } from './jobs/ewi-investigation.processor';
import { EwiInvestigationGateway } from './gateway/ewi-investigation.gateway';
import { EwiInvestigationController } from './controllers/ewi-investigation.controller';

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
    AiModule,
    ReportModule,
    ExpertResearchIntegrationsModule,
  ],
  controllers: [EwiInvestigationController],
  providers: [
    ExpertResearchOrchestrator,
    EwiWordReportService,
    EwiAnalysisService,
    ExpertInvestigationRepository,
    InvestigationHistoryService,
    ExpertInvestigationService,
    EwiInvestigationJobService,
    EwiInvestigationProcessor,
    EwiInvestigationGateway,
  ],
  exports: [
    ExpertInvestigationService,
    EwiInvestigationJobService,
    InvestigationHistoryService,
  ],
})
export class EwiInvestigationModule implements OnModuleInit {
  private readonly logger = new Logger(EwiInvestigationModule.name);

  constructor(
    private readonly gateway: EwiInvestigationGateway,
    private readonly jobService: EwiInvestigationJobService,
  ) {}

  onModuleInit(): void {
    this.jobService.setGateway(this.gateway);
    this.logger.log('EWI investigation module initialized');
  }
}
