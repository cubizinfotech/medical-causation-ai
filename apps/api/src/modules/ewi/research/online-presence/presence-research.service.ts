import { Injectable } from '@nestjs/common';
import {
  ExpertResearchService,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { buildOnlinePresenceDossier } from './presence-research-analyzer';
import type { OnlinePresenceDossier } from './presence.types';

/** Catalog providers consulted for online presence research. */
export const ONLINE_PRESENCE_PROVIDER_IDS = [
  'expert_website',
  'advertising',
  'other_public_websites',
  'ime_websites',
  'ime_advertising',
  'expert_directory',
  'dri',
  'seak',
  'alm_law',
  'jurispro',
  'expertlaw',
  'expertpages',
  'expertwitness_com',
  'other_expert_directories',
  'youtube',
  'presentations',
  'powerpoints',
  'social',
  'news',
  'blogs',
  'patient_reviews',
  'google_maps',
] as const satisfies readonly ExpertResearchProviderId[];

/**
 * Online presence facade over the shared expert-research catalog.
 * Does not scrape private accounts or bypass authentication.
 */
@Injectable()
export class OnlinePresenceResearchService {
  constructor(private readonly research: ExpertResearchService) {}

  async collect(query: ExpertResearchQuery): Promise<{
    sourceResults: ExpertResearchSourceResult[];
    dossier: OnlinePresenceDossier;
  }> {
    const sourceResults = await this.research.collectProviders(
      query,
      ONLINE_PRESENCE_PROVIDER_IDS,
    );
    const evidence = sourceResults.flatMap((result) => result.items);
    return {
      sourceResults,
      dossier: buildOnlinePresenceDossier({
        evidence,
        sourceResults,
        presenceProviderIds: ONLINE_PRESENCE_PROVIDER_IDS,
      }),
    };
  }

  buildDossier(input: {
    evidence: Parameters<typeof buildOnlinePresenceDossier>[0]['evidence'];
    sourceResults?: ExpertResearchSourceResult[];
  }): OnlinePresenceDossier {
    return buildOnlinePresenceDossier({
      ...input,
      presenceProviderIds: ONLINE_PRESENCE_PROVIDER_IDS,
    });
  }
}
