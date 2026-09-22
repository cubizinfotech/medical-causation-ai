/**
 * Expert research source contracts (shared integrations layer).
 * Product modules consume these; adapters live under integrations/expert-research.
 */

export type ExpertResearchSourceId =
  | 'mock'
  | 'npi'
  | 'pubmed'
  | 'orcid'
  | 'courtlistener'
  | 'uspto'
  | 'news'
  | 'web_search';

export interface ExpertResearchQuery {
  expertName: string;
  specialty: string;
}

export interface ExpertEvidenceItem {
  sourceId: ExpertResearchSourceId;
  category: string;
  title: string;
  summary: string;
  url?: string;
  raw?: Record<string, unknown>;
  simulated?: boolean;
}

export interface ExpertResearchSourceResult {
  sourceId: ExpertResearchSourceId;
  items: ExpertEvidenceItem[];
  status: 'ok' | 'skipped' | 'error';
  message?: string;
}

export interface IExpertResearchSource {
  readonly sourceId: ExpertResearchSourceId;
  isEnabled(): boolean;
  search(query: ExpertResearchQuery): Promise<ExpertResearchSourceResult>;
}
