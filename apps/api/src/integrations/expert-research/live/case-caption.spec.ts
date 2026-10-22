import {
  captionFromDocketUrl,
  captionSlugIsReliable,
  resolveCaseCaption,
} from './case-caption';

describe('resolveCaseCaption', () => {
  it('keeps a short but complete stored caption such as Doe v. Roe', () => {
    expect(
      resolveCaseCaption({
        caseName: 'Doe v. Roe',
        absolute_url: '/opinion/1/doe-v-roe/',
      }),
    ).toEqual({
      name: 'Doe v. Roe',
      status: 'from_source',
    });
  });

  it('uses a complete stored caption', () => {
    expect(
      resolveCaseCaption({
        caseName: 'Head Kandy LLC v. Mutual of Omaha Insurance Company',
      }),
    ).toEqual({
      name: 'Head Kandy LLC v. Mutual of Omaha Insurance Company',
      status: 'from_source',
    });
  });

  it('resolves a complete docket slug when no API caption is present', () => {
    expect(
      resolveCaseCaption({
        caseName: 'Caption not listed on this search result',
        absolute_url:
          '/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
      }),
    ).toEqual({
      name: 'Roberts v. USAA General Indemnity Company',
      status: 'from_source',
    });
  });

  it('does not treat a truncated slug as a complete caption', () => {
    expect(
      resolveCaseCaption({
        absolute_url: '/docket/6664619/49/1/united-states-v-butl',
      }),
    ).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
    expect(
      captionFromDocketUrl('/docket/6664619/49/1/united-states-v-butl'),
    ).toBeNull();
    expect(captionSlugIsReliable('united-states-v-butl')).toBe(false);
  });

  it('does not keep a stored caption that was itself formatted from a truncated slug', () => {
    expect(
      resolveCaseCaption({
        caseName: 'United States v. Butl',
        absolute_url: '/docket/6664619/49/1/united-states-v-butl',
      }),
    ).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
  });

  it('leaves a one-letter defendant slug unresolved', () => {
    expect(
      resolveCaseCaption({
        absolute_url: '/docket/66837428/431/1/head-kandy-llc-v-m',
      }),
    ).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
  });

  it('leaves a cut-off corporate suffix unresolved', () => {
    expect(
      resolveCaseCaption({
        absolute_url: '/docket/1/1/head-kandy-llc-v-mutual-of-omaha-insur',
      }),
    ).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
  });

  it('leaves a URL without a vs-slug unresolved', () => {
    expect(
      resolveCaseCaption({
        absolute_url: 'https://www.courtlistener.com/docket/999/26/',
      }),
    ).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
  });

  it('prefers a complete API caption over a truncated URL slug', () => {
    expect(
      resolveCaseCaption({
        caseName: 'Head Kandy LLC v. Mutual of Omaha Insurance Company',
        absolute_url: '/docket/66837428/431/1/head-kandy-llc-v-m',
      }),
    ).toEqual({
      name: 'Head Kandy LLC v. Mutual of Omaha Insurance Company',
      status: 'from_source',
    });
  });

  it('does not invent Unnamed case when nothing usable is present', () => {
    expect(resolveCaseCaption({})).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
    expect(resolveCaseCaption({ caseName: 'Unnamed case' })).toEqual({
      name: 'Caption not listed on this search result',
      status: 'unresolved',
    });
  });
});
