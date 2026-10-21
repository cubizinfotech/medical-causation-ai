import { researchCoverageFor, researchOutcomeFor } from './research-outcome';

describe('researchOutcomeFor / researchCoverageFor', () => {
  it('classifies a completed empty search as searched_no_results', () => {
    expect(
      researchCoverageFor({
        status: 'no_result',
        outcome: 'no_result',
        itemCount: 0,
      }),
    ).toBe('searched_no_results');
    expect(
      researchCoverageFor({
        status: 'no_result',
        outcome: 'no_result',
        itemCount: 1,
      }),
    ).toBe('searched_no_results');
  });

  it('classifies a successful search with items as searched_with_results', () => {
    expect(
      researchCoverageFor({
        status: 'ok',
        outcome: 'success',
        itemCount: 2,
      }),
    ).toBe('searched_with_results');
  });

  it('classifies an unimplemented placeholder from its message', () => {
    expect(
      researchOutcomeFor({
        status: 'unavailable',
        access: 'public',
        message:
          'Not searched. Patents live adapter is not connected. No record was retrieved.',
        itemCount: 0,
      }),
    ).toBe('not_implemented');
    expect(
      researchCoverageFor({
        status: 'unavailable',
        message: 'Not searched. Patents live adapter is not connected.',
        itemCount: 0,
      }),
    ).toBe('not_implemented');
  });

  it('classifies a missing API key as not_configured', () => {
    expect(
      researchCoverageFor({
        status: 'unavailable',
        message: 'Not searched: no web search provider is configured.',
        itemCount: 0,
      }),
    ).toBe('not_configured');
  });

  it('classifies timeouts and HTTP failures as failed, not empty searches', () => {
    expect(
      researchCoverageFor({
        status: 'error',
        outcome: 'timeout',
        message: 'The source timed out.',
        itemCount: 0,
      }),
    ).toBe('failed');
    expect(
      researchCoverageFor({
        status: 'error',
        outcome: 'api_failure',
        message: 'The source returned HTTP 500.',
        itemCount: 0,
      }),
    ).toBe('failed');
  });

  it('classifies bot protection as blocked_or_access_denied', () => {
    expect(
      researchCoverageFor({
        status: 'error',
        message:
          'Justia presented a bot-protection or access wall. The results page was not read.',
        itemCount: 0,
      }),
    ).toBe('blocked_or_access_denied');
  });

  it('does not treat a skipped dedicated directory as an empty search', () => {
    expect(
      researchCoverageFor({
        status: 'skipped',
        outcome: 'unavailable',
        message:
          'A general web search ran. SEAK listings were not searched as a dedicated source. This is not a finding that none exist.',
        itemCount: 0,
      }),
    ).toBe('skipped');
  });

  it('classifies skipped searches separately from empty results', () => {
    expect(
      researchCoverageFor({
        status: 'ok',
        outcome: 'success',
        message: 'Skipped. Already collected in this investigation.',
        itemCount: 1,
        skipped: true,
      }),
    ).toBe('skipped');
  });

  it('does not treat a stored restricted placeholder as a completed search', () => {
    expect(
      researchCoverageFor({
        status: 'unavailable',
        outcome: 'restricted',
        access: 'restricted',
        message:
          'Not searched. LexisNexis is restricted. No request was sent. LexisNexis PDFs are not stored.',
        itemCount: 0,
      }),
    ).toBe('not_implemented');
  });

  it('classifies rate limits as failed, not as empty searches', () => {
    expect(
      researchCoverageFor({
        status: 'error',
        outcome: 'rate_limited',
        message: 'The source returned a rate limit.',
        itemCount: 0,
      }),
    ).toBe('failed');
  });
});
