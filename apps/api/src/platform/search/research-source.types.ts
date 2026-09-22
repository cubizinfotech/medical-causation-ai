/**
 * Common search / research source abstraction.
 * Literature (MCA) and expert research (EWI) adapters implement this contract.
 */
export interface ResearchQuery {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ResearchHit {
  id: string;
  title: string;
  summary: string;
  url?: string;
  source: string;
  simulated?: boolean;
  raw?: Record<string, unknown>;
}

export interface ResearchSourceResult {
  source: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
  hits: ResearchHit[];
}

export interface IResearchSource {
  readonly sourceId: string;
  isEnabled(): boolean;
  search(query: ResearchQuery): Promise<ResearchSourceResult>;
}
