import { Injectable } from '@nestjs/common';
import { MockExpertResearchSource } from './mock-expert-research.source';
import { StubExpertResearchSource } from './stub-expert-research.source';
import type {
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  IExpertResearchSource,
} from './expert-research.types';

@Injectable()
export class ExpertResearchSourceRegistry {
  private readonly sources: IExpertResearchSource[];

  constructor() {
    this.sources = [
      new MockExpertResearchSource(),
      new StubExpertResearchSource('npi', 'NPI_API_KEY'),
      new StubExpertResearchSource('pubmed', 'PUBMED_API_KEY'),
      new StubExpertResearchSource('orcid', 'ORCID_CLIENT_ID'),
      new StubExpertResearchSource('courtlistener', 'COURTLISTENER_API_TOKEN'),
      new StubExpertResearchSource('uspto', 'USPTO_API_KEY'),
      new StubExpertResearchSource('news', 'NEWS_API_KEY'),
      new StubExpertResearchSource('web_search', 'WEB_SEARCH_API_KEY'),
    ];
  }

  list(): IExpertResearchSource[] {
    return [...this.sources];
  }

  async searchAll(
    query: ExpertResearchQuery,
  ): Promise<ExpertResearchSourceResult[]> {
    const results: ExpertResearchSourceResult[] = [];
    for (const source of this.sources) {
      results.push(await source.search(query));
    }
    return results;
  }
}
