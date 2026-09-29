import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { EmailModule } from '@platform/email/email.module';
import { EwiCorrespondenceService } from './ewi-correspondence.service';
import { EwiRequestController } from './ewi-request.controller';
import { EwiRequestRepository } from './ewi-request.repository';
import { EwiRequestWorkflowService } from './ewi-request-workflow.service';

@Module({
  imports: [EmailModule, DatabaseModule],
  controllers: [EwiRequestController],
  providers: [
    EwiCorrespondenceService,
    EwiRequestRepository,
    EwiRequestWorkflowService,
  ],
  exports: [EwiCorrespondenceService, EwiRequestWorkflowService],
})
export class EwiCorrespondenceModule {}
