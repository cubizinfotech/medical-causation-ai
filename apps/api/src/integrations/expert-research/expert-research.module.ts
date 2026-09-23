import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResearchProviderSettings } from '@config/config.types';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  ExpertResearchService,
} from './expert-research.service';

@Module({
  providers: [
    {
      provide: ExpertResearchService,
      useFactory: (config: ConfigService) =>
        new ExpertResearchService(
          createCatalogProviders(
            createExpertResearchRuntime(
              config.get<ResearchProviderSettings>('research'),
            ),
          ),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [ExpertResearchService],
})
export class ExpertResearchIntegrationsModule {}
