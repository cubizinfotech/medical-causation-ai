import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  IExpertResearchProvider,
  ProviderDefinition,
} from '../expert-research.types';
import {
  developmentFixtures,
  type DevelopmentFixture,
} from './development-fixtures';
import { researchOutcomeFor } from './research-outcome';
import {
  ProviderRateLimitError,
  ProviderRateLimiter,
  ProviderTimeoutError,
  validateExpertResearchQuery,
  withTimeout,
  type ProviderRuntimeOptions,
} from './provider-runtime';

const UNAVAILABLE_MESSAGE =
  'No record was retrieved. This does not establish that the expert lacks a credential, publication, case, license, or award.';

export class CatalogExpertResearchProvider implements IExpertResearchProvider {
  constructor(
    readonly definition: ProviderDefinition,
    private readonly runtime: ProviderRuntimeOptions,
    private readonly rateLimiter: ProviderRateLimiter,
    private readonly loadFixtures: (
      query: ExpertResearchQuery,
    ) =>
      | DevelopmentFixture[]
      | undefined
      | Promise<DevelopmentFixture[] | undefined> = (query) => {
      const table = developmentFixtures(query);
      if (!Object.prototype.hasOwnProperty.call(table, definition.id)) {
        return undefined;
      }
      return table[definition.id] ?? [];
    },
  ) {}

  get id() {
    return this.definition.id;
  }

  async search(
    query: ExpertResearchQuery,
  ): Promise<ExpertResearchSourceResult> {
    const retrievedAt = new Date().toISOString();
    const validated = validateExpertResearchQuery(query);
    if (!validated.ok) {
      return this.emptyResult('error', retrievedAt, validated.message);
    }

    if (this.runtime.mode === 'live') {
      if (this.definition.accessClass === 'restricted') {
        return this.emptyResult(
          'unavailable',
          retrievedAt,
          `${this.definition.name} is restricted. No request was sent.${
            this.definition.id === 'lexisnexis'
              ? ' LexisNexis PDFs are not stored.'
              : ''
          }`,
          'restricted',
        );
      }
      if (this.definition.requirement !== 'free_api' && this.definition.requirement !== 'manual') {
        return this.emptyResult(
          'unavailable',
          retrievedAt,
          `${this.definition.name} requires authorized access. No request was sent.`,
          'unavailable',
        );
      }
      return this.emptyResult(
        'unavailable',
        retrievedAt,
        `${this.definition.name} live adapter is not connected. ${UNAVAILABLE_MESSAGE}`,
        'unavailable',
      );
    }

    try {
      this.rateLimiter.acquire(this.definition.id, this.runtime.minIntervalMs);
      const fixtures = await withTimeout(
        Promise.resolve(this.loadFixtures(validated.value)),
        this.runtime.timeoutMs,
      );
      if (fixtures === undefined) {
        return this.emptyResult(
          'unavailable',
          retrievedAt,
          `${this.definition.name} has no development fixture. ${UNAVAILABLE_MESSAGE}`,
          'unavailable',
        );
      }
      if (fixtures.length === 0) {
        return this.emptyResult(
          'no_result',
          retrievedAt,
          `${this.definition.name} returned no record. ${UNAVAILABLE_MESSAGE}`,
          this.definition.accessClass === 'restricted'
            ? 'restricted'
            : 'public',
        );
      }
      const items = fixtures.map((fixture) => this.toItem(fixture, retrievedAt));
      const access = this.definition.accessClass;
      return {
        sourceId: this.definition.id,
        status: 'ok',
        outcome: researchOutcomeFor({
          status: 'ok',
          access,
          itemCount: items.length,
        }),
        access,
        message: 'Development fixtures. Not retrieved from the live source.',
        retrievedAt,
        items,
      };
    } catch (error) {
      if (error instanceof ProviderRateLimitError) {
        return this.emptyResult('error', retrievedAt, error.message);
      }
      if (error instanceof ProviderTimeoutError) {
        return this.emptyResult('error', retrievedAt, error.message);
      }
      const message =
        error instanceof Error ? error.message : 'Provider failed';
      return this.emptyResult('error', retrievedAt, message);
    }
  }

  private toItem(
    fixture: DevelopmentFixture,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const restricted =
      fixture.access === 'restricted' ||
      this.definition.accessClass === 'restricted';
    return {
      sourceId: this.definition.id,
      category: fixture.category,
      title: fixture.title,
      summary: restricted ? '' : fixture.summary,
      url: fixture.url,
      simulated: true,
      access: restricted ? 'restricted' : fixture.access,
      informationStatus: fixture.informationStatus,
      retrievedAt,
      source: {
        providerId: this.definition.id,
        name: this.definition.name,
        url: fixture.url,
        retrievedAt,
        access: restricted ? 'restricted' : fixture.access,
      },
      raw: restricted ? { metadataOnly: true, fixture: true } : fixture.raw,
    };
  }

  private emptyResult(
    status: ExpertResearchSourceResult['status'],
    retrievedAt: string,
    message: string,
    access: ExpertResearchSourceResult['access'] = this.definition.accessClass,
  ): ExpertResearchSourceResult {
    return {
      sourceId: this.definition.id,
      status,
      outcome: researchOutcomeFor({
        status,
        access,
        message,
        itemCount: 0,
      }),
      access,
      message,
      retrievedAt,
      items: [],
    };
  }
}
