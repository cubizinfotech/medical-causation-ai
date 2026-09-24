import { Module } from '@nestjs/common';
import { EmailModule } from '@platform/email/email.module';
import { EwiCorrespondenceService } from './ewi-correspondence.service';

@Module({
  imports: [EmailModule],
  providers: [EwiCorrespondenceService],
  exports: [EwiCorrespondenceService],
})
export class EwiCorrespondenceModule {}
