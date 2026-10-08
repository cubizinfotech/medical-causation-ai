import { Injectable, Logger } from '@nestjs/common';
import {
  MedicalLiteratureService,
  type EvidenceType,
  type LiteratureArticle,
  type LiteratureSearchRequest,
} from '@integrations/medical-literature';
import type {
  LiteratureSearchSummary,
  MedicalAnalysisRequest,
  PublicReference,
} from '../types';
import {
  buildFallbackLiteratureRequest,
  parseLiteratureSuggestion,
} from './literature-query.helpers';

export interface CaseLiteratureResult {
  summary: LiteratureSearchSummary;
  references: PublicReference[];
}

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  meta_analysis: 'Meta-analysis',
  systematic_review: 'Systematic review',
  guideline: 'Guideline',
  randomized_trial: 'Randomized trial',
  observational: 'Observational study',
  review: 'Review',
  case_report: 'Case report',
  other: 'Study',
};

function formatAuthors(authors: string[]): string | undefined {
  if (authors.length === 0) return undefined;
  return authors.length > 3
    ? `${authors.slice(0, 3).join(', ')}, et al.`
    : authors.join(', ');
}

export function toPublicReference(article: LiteratureArticle): PublicReference {
  return {
    id: `pmid-${article.pmid}`,
    title: article.title,
    source: 'PubMed',
    url: article.pubmedUrl,
    year: article.year,
    excerpt: article.abstractExcerpt,
    pmid: article.pmid,
    doi: article.doi,
    pmcid: article.pmcid,
    authors: formatAuthors(article.authors),
    journal: article.journal || undefined,
    publicationType: EVIDENCE_LABELS[article.evidenceType],
    fullTextUrl: article.fullTextUrl,
  };
}

/**
 * Finds published studies on the case's causation question.
 * Never throws: a failed search is reported in the summary instead, so the
 * analysis itself still completes.
 */
@Injectable()
export class CaseLiteratureService {
  private readonly logger = new Logger(CaseLiteratureService.name);

  constructor(private readonly literature: MedicalLiteratureService) {}

  /**
   * @param suggestion the literatureSearch field from the analysis model's
   *   JSON. No separate AI call is made, so the search adds no AI cost and
   *   no extra load on rate-limited providers.
   */
  async research(
    request: MedicalAnalysisRequest,
    suggestion?: unknown,
  ): Promise<CaseLiteratureResult> {
    const searchedAt = new Date().toISOString();
    const summary = (
      fields: Partial<LiteratureSearchSummary> &
        Pick<LiteratureSearchSummary, 'status'>,
    ): LiteratureSearchSummary => ({
      provider: 'PubMed',
      queries: [],
      queryMethod: 'ai',
      abstractsAvailable: false,
      searchedAt,
      ...fields,
    });

    if (!this.literature.enabled) {
      return {
        summary: summary({
          status: 'disabled',
          message:
            'Public literature search is turned off (FEATURE_LITERATURE_SEARCH=false).',
        }),
        references: [],
      };
    }

    const plan = this.planSearch(request, suggestion);
    if (!plan) {
      return {
        summary: summary({
          status: 'unavailable',
          message:
            'Search terms could not be prepared from this case. Add a diagnosis and try again.',
        }),
        references: [],
      };
    }

    try {
      const result = await this.literature.search(plan.request);
      const references = result.articles.map(toPublicReference);
      return {
        summary: summary({
          status: references.length > 0 ? 'completed' : 'no_results',
          queries: plan.request.queries,
          queryMethod: plan.method,
          abstractsAvailable: result.abstractsAvailable,
          message:
            references.length > 0
              ? undefined
              : 'PubMed returned no matching peer-reviewed studies for these queries.',
        }),
        references,
      };
    } catch (error) {
      this.logger.warn(
        `Literature search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        summary: summary({
          status: 'unavailable',
          queries: plan.request.queries,
          queryMethod: plan.method,
          message:
            'PubMed could not be reached. The analysis used the firm library only.',
        }),
        references: [],
      };
    }
  }

  private planSearch(
    request: MedicalAnalysisRequest,
    suggestion: unknown,
  ): { request: LiteratureSearchRequest; method: 'ai' | 'keywords' } | null {
    const parsed = parseLiteratureSuggestion(suggestion);
    if (parsed) return { request: parsed, method: 'ai' };
    if (suggestion !== undefined) {
      this.logger.warn(
        'Suggested literature search was unusable; using keywords',
      );
    }
    const fallback = buildFallbackLiteratureRequest(request);
    return fallback ? { request: fallback, method: 'keywords' } : null;
  }
}
