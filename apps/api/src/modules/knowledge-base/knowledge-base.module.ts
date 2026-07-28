import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { DocumentDiscoveryService } from './services/document-discovery.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';

@Module({
  imports: [AppConfigModule],
  providers: [DocumentDiscoveryService, KnowledgeBaseService],
  exports: [KnowledgeBaseService, DocumentDiscoveryService],
})
export class KnowledgeBaseModule {}
