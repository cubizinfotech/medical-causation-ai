import {
  ProviderRateLimitError,
  ProviderRateLimiter,
  ProviderTimeoutError,
  validateExpertResearchQuery,
  withTimeout,
} from './provider-runtime';

describe('expert research provider runtime', () => {
  it('rejects an empty expert name, city, and specialty', () => {
    expect(
      validateExpertResearchQuery({
        expertName: ' ',
        city: 'Boston',
        specialty: 'Ortho',
      }).ok,
    ).toBe(false);
    expect(
      validateExpertResearchQuery({
        expertName: 'Ada Lovelace',
        city: ' ',
        specialty: 'Orthopedics',
      }).ok,
    ).toBe(false);
    expect(
      validateExpertResearchQuery({
        expertName: 'Ada Lovelace',
        city: 'Boston',
        specialty: ' ',
      }).ok,
    ).toBe(false);
  });

  it('accepts a name, city, and specialty', () => {
    const result = validateExpertResearchQuery({
      expertName: ' Ada Lovelace ',
      city: ' Boston ',
      specialty: ' Orthopedics ',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        expertName: 'Ada Lovelace',
        city: 'Boston',
        specialty: 'Orthopedics',
      },
    });
  });

  it('times out work that exceeds the limit', async () => {
    const work = new Promise((resolve) =>
      setTimeout(() => resolve('late'), 30),
    );
    await expect(withTimeout(work, 5)).rejects.toBeInstanceOf(
      ProviderTimeoutError,
    );
  });

  it('rate limits a second call inside the interval', () => {
    let now = 1_000;
    const limiter = new ProviderRateLimiter(() => now);
    limiter.acquire('pubmed', 50);
    expect(() => limiter.acquire('pubmed', 50)).toThrow(ProviderRateLimitError);
    now = 1_050;
    expect(() => limiter.acquire('pubmed', 50)).not.toThrow();
  });
});
