import { Logger } from '@nestjs/common';
import type { LiteratureSearchSettings } from '@config/config.types';
import { EuropePmcClient } from './europe-pmc.client';
import {
  classifyArticle,
  extractAbstractExcerpt,
  parsePublicationYear,
  rankCandidates,
} from './literature-ranking';
import type {
  LiteratureArticle,
  LiteratureSearchRequest,
  LiteratureSearchResponse,
} from './medical-literature.types';
import { PubMedClient } from './pubmed.client';

const MAX_QUERIES = 3;

/**
 * Searches PubMed for published studies on a causation question.
 * Only the queries leave the server; they carry medical terms, not
 * patient details.
 */
export class MedicalLiteratureService {
  private readonly logger = new Logger(MedicalLiteratureService.name);

  constructor(
    private readonly settings: LiteratureSearchSettings,
    private readonly pubmed: PubMedClient,
    private readonly europePmc: EuropePmcClient,
  ) {}

  get enabled(): boolean {
    return this.settings.enabled;
  }

  /** Throws only when every query failed (PubMed unreachable). */
  async search(
    request: LiteratureSearchRequest,
  ): Promise<LiteratureSearchResponse> {
    const queries = [...new Set(request.queries.map((q) => q.trim()))]
      .filter(Boolean)
      .slice(0, MAX_QUERIES);

    const rankedLists: Array<{ query: string; ids: string[] }> = [];
    const failedQueries: string[] = [];
    let lastError: unknown;
    for (const query of queries) {
      try {
        const { ids } = await this.pubmed.search(
          query,
          this.settings.resultsPerQuery,
        );
        rankedLists.push({ query, ids });
      } catch (error) {
        lastError = error;
        failedQueries.push(query);
        this.logger.warn(
          `PubMed query failed ("${query}"): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (queries.length > 0 && rankedLists.length === 0) {
      throw lastError instanceof Error
        ? lastError
        : new Error('PubMed search failed');
    }

    const candidateIds = [...new Set(rankedLists.flatMap((list) => list.ids))];
    if (candidateIds.length === 0) {
      return { articles: [], abstractsAvailable: false, failedQueries };
    }

    const summaries = await this.pubmed.summaries(candidateIds);
    const top = rankCandidates({
      rankedLists,
      summaries,
      exposureTerms: request.exposureTerms,
      outcomeTerms: request.outcomeTerms,
    }).slice(0, this.settings.maxResults);

    let abstracts = new Map<
      string,
      { abstractHtml: string; pmcid?: string; isOpenAccess: boolean }
    >();
    let abstractsAvailable = top.length > 0;
    if (top.length > 0) {
      try {
        abstracts = await this.europePmc.abstracts(top.map((c) => c.pmid));
      } catch (error) {
        // Articles are still real and linked; only the excerpts are missing.
        abstractsAvailable = false;
        this.logger.warn(
          `Europe PMC abstracts unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const articles = top.map(({ pmid, matchedQueries }): LiteratureArticle => {
      const summary = summaries.get(pmid)!;
      const ids = new Map(
        (summary.articleids ?? []).map((id) => [id.idtype, id.value]),
      );
      const abstract = abstracts.get(pmid);
      const pmcid = abstract?.pmcid ?? ids.get('pmc');
      const publicationTypes = summary.pubtype ?? [];

      return {
        pmid,
        title: summary.title.trim(),
        authors: (summary.authors ?? [])
          .filter((author) => !author.authtype || author.authtype === 'Author')
          .map((author) => author.name),
        journal: summary.fulljournalname ?? summary.source ?? '',
        year: parsePublicationYear(summary.pubdate),
        publicationTypes,
        evidenceType: classifyArticle(publicationTypes, summary.title),
        doi: ids.get('doi'),
        pmcid,
        abstractExcerpt: abstract
          ? extractAbstractExcerpt(abstract.abstractHtml)
          : undefined,
        matchedQueries,
        pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        fullTextUrl: pmcid
          ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`
          : undefined,
      };
    });

    return { articles, abstractsAvailable, failedQueries };
  }
}
