/**
 * Runs chosen EWI research sources (not the web layer) against the real public
 * APIs for one person and prints each source's outcome and message, so a
 * section that came back empty can be explained. Nothing is written.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/live-expert-sources.ts --name "Jason A. Demery" --specialty Neuropsychology --city "Gainesville Florida" --sources npi_registry,pubmed,openalex
 *
 * Options: --name --specialty --city --npi --sources a,b,c
 */
import { researchConfig } from '../src/config/research.config';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  ExpertResearchService,
} from '../src/integrations/expert-research/expert-research.service';
import type { ExpertResearchProviderId } from '../src/integrations/expert-research/expert-research.types';
import { loadEnv } from './user-accounts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  loadEnv();
  const settings = { ...researchConfig(), mode: 'live' as const };
  const runtime = createExpertResearchRuntime(settings);
  const service = new ExpertResearchService(createCatalogProviders(runtime));
  const sources = (
    arg('sources') ?? 'npi_registry,pubmed,openalex,crossref'
  ).split(',') as ExpertResearchProviderId[];
  const results = await service.collectProviders(
    {
      expertName: arg('name') ?? 'Jason A. Demery',
      specialty: arg('specialty') ?? 'Neuropsychology',
      city: arg('city') ?? '',
      npi: arg('npi'),
    },
    sources,
  );
  for (const result of results) {
    console.log(
      `\n[${result.sourceId}] status=${result.status} outcome=${result.outcome ?? '-'} items=${result.items.length}`,
    );
    console.log(`  ${result.message}`);
    for (const item of result.items.slice(0, 8)) {
      console.log(
        `  - (${item.category}, ${item.identityMatch ?? 'n/a'}) ${item.title.slice(0, 120)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
