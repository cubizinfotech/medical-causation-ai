import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResearchProviderSettings } from '@config/config.types';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  createPublicationLookup,
  ExpertResearchService,
} from './expert-research.service';

@Module({
  providers: [
    {
      provide: ExpertResearchService,
      useFactory: (config: ConfigService) => {
        const runtime = createExpertResearchRuntime(
          config.get<ResearchProviderSettings>('research'),
        );
        return new ExpertResearchService(
          createCatalogProviders(runtime),
          createPublicationLookup(runtime),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [ExpertResearchService],
})
export class ExpertResearchIntegrationsModule {}
