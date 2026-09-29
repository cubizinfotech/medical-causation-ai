import { Injectable } from '@nestjs/common';
import {
  ExpertResearchService,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { buildLegalResearchDossier } from './legal-research-analyzer';
import type { LegalResearchDossier } from './legal-matter.types';

/** Catalog providers consulted for legal research. */
export const LEGAL_RESEARCH_PROVIDER_IDS = [
  'courtlistener',
  'justia',
  'state_court_records',
  'motions',
  'orders',
  'pleadings',
  'depositions',
  'expert_testimony',
  'lexisnexis',
  'criminal_records',
  'malpractice_records',
] as const satisfies readonly ExpertResearchProviderId[];

/**
 * Legal research facade over the shared expert-research catalog.
 * Product code uses this for legal source selection. Providers stay in integrations.
 */
@Injectable()
export class LegalResearchService {
  constructor(private readonly research: ExpertResearchService) {}

  async collect(query: ExpertResearchQuery): Promise<{
    sourceResults: ExpertResearchSourceResult[];
    dossier: LegalResearchDossier;
  }> {
    const sourceResults = await this.research.collectProviders(
      query,
      LEGAL_RESEARCH_PROVIDER_IDS,
    );
    const evidence = sourceResults.flatMap((result) => result.items);
    return {
      sourceResults,
      dossier: buildLegalResearchDossier({
        evidence,
        sourceResults,
        legalProviderIds: LEGAL_RESEARCH_PROVIDER_IDS,
      }),
    };
  }

  buildDossier(input: {
    evidence: Parameters<typeof buildLegalResearchDossier>[0]['evidence'];
    sourceResults?: ExpertResearchSourceResult[];
  }): LegalResearchDossier {
    return buildLegalResearchDossier({
      ...input,
      legalProviderIds: LEGAL_RESEARCH_PROVIDER_IDS,
    });
  }
}
