import type {
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  ExpertResearchSourceId,
  IExpertResearchSource,
} from './expert-research.types';

/**
 * Stub adapter for a future paid/public API.
 * Returns skipped when not configured; never invents live data.
 */
export class StubExpertResearchSource implements IExpertResearchSource {
  constructor(
    readonly sourceId: ExpertResearchSourceId,
    private readonly envKey: string,
  ) {}

  isEnabled(): boolean {
    const value = process.env[this.envKey];
    return Boolean(value && value.trim().length > 0);
  }

  search(_query: ExpertResearchQuery): Promise<ExpertResearchSourceResult> {
    void _query;
    if (!this.isEnabled()) {
      return Promise.resolve({
        sourceId: this.sourceId,
        status: 'skipped',
        message: `${this.envKey} not configured — stub only`,
        items: [],
      });
    }

    return Promise.resolve({
      sourceId: this.sourceId,
      status: 'skipped',
      message: `${this.sourceId} adapter not yet implemented — configure for future use`,
      items: [],
    });
  }
}
