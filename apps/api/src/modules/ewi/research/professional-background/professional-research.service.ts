import { Injectable } from '@nestjs/common';
import {
  ExpertResearchService,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { buildProfessionalBackgroundDossier } from './professional-research-analyzer';
import type { ProfessionalBackgroundDossier } from './professional.types';

/** Catalog providers consulted for professional/financial/background research. */
export const PROFESSIONAL_BACKGROUND_PROVIDER_IDS = [
  'grants',
  'grant_results',
  'patents',
  'trademarks',
  'awards',
  'military_claims',
  'memberships',
  'professional_organizations',
  'constitutional_sheriff',
  'post_records',
  'oath_keepers',
  'corporate_affiliations',
  'open_payments',
] as const satisfies readonly ExpertResearchProviderId[];

/**
 * Professional/financial facade over the shared expert-research catalog.
 * Does not invent memberships, percentages, or military service conclusions.
 */
@Injectable()
export class ProfessionalBackgroundResearchService {
  constructor(private readonly research: ExpertResearchService) {}

  async collect(query: ExpertResearchQuery): Promise<{
    sourceResults: ExpertResearchSourceResult[];
    dossier: ProfessionalBackgroundDossier;
  }> {
    const sourceResults = await this.research.collectProviders(
      query,
      PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
    );
    const evidence = sourceResults.flatMap((result) => result.items);
    return {
      sourceResults,
      dossier: buildProfessionalBackgroundDossier({
        evidence,
        sourceResults,
        professionalProviderIds: PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
      }),
    };
  }

  buildDossier(input: {
    evidence: Parameters<
      typeof buildProfessionalBackgroundDossier
    >[0]['evidence'];
    sourceResults?: ExpertResearchSourceResult[];
  }): ProfessionalBackgroundDossier {
    return buildProfessionalBackgroundDossier({
      ...input,
      professionalProviderIds: PROFESSIONAL_BACKGROUND_PROVIDER_IDS,
    });
  }
}
