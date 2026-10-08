import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LiteratureSearchSettings } from '@config/config.types';
import { literatureConfig } from '@config/literature.config';
import { EuropePmcClient } from './europe-pmc.client';
import { MedicalLiteratureService } from './medical-literature.service';
import { PubMedClient } from './pubmed.client';

@Module({
  providers: [
    {
      provide: MedicalLiteratureService,
      useFactory: (config: ConfigService) => {
        const settings =
          config.get<LiteratureSearchSettings>('literature') ??
          literatureConfig();
        return new MedicalLiteratureService(
          settings,
          new PubMedClient(settings),
          new EuropePmcClient(settings),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [MedicalLiteratureService],
})
export class MedicalLiteratureModule {}
