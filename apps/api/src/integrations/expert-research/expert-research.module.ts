import { Module } from '@nestjs/common';
import { ExpertResearchSourceRegistry } from './expert-research-source.registry';

@Module({
  providers: [ExpertResearchSourceRegistry],
  exports: [ExpertResearchSourceRegistry],
})
export class ExpertResearchIntegrationsModule {}
