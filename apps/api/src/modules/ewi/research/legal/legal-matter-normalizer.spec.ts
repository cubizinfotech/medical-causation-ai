import { normalizeLegalMatters } from './legal-matter-normalizer';

describe('normalizeLegalMatters captions', () => {
  it('resolves a missing CourtListener caption from the docket URL slug', () => {
    const matters = normalizeLegalMatters([
      {
        sourceId: 'courtlistener',
        category: 'court_order',
        title:
          'ORDER granting 24 Motion to Compel — Caption not listed on this search result',
        summary: 'Search snippet only.',
        url: 'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
        informationStatus: 'unverified',
        raw: {
          caseName: 'Caption not listed on this search result',
          captionStatus: 'unresolved',
          documentType: 'order',
        },
      },
    ]);
    expect(matters[0].caseName).toBe(
      'Roberts v. USAA General Indemnity Company',
    );
    expect(matters[0].title).toMatch(
      /Roberts v\. USAA General Indemnity Company/,
    );
    expect(matters[0].title).not.toMatch(/Caption not listed/i);
  });

  it('keeps distinct docket documents separate', () => {
    const matters = normalizeLegalMatters([
      {
        sourceId: 'courtlistener',
        category: 'motion',
        title: 'Daubert motion',
        summary: 'Search snippet of a Daubert motion.',
        url: 'https://www.courtlistener.com/docket/66837428/431/head-kandy-llc-v-mcneill/',
        informationStatus: 'unverified',
        raw: { documentNumber: '431', documentType: 'motion' },
      },
      {
        sourceId: 'courtlistener',
        category: 'motion',
        title: 'Motion to strike',
        summary: 'Search snippet of a motion to strike.',
        url: 'https://www.courtlistener.com/docket/66837428/174/davis-v-little-giant-ladder-systems-llc/',
        informationStatus: 'unverified',
        raw: { documentNumber: '174', documentType: 'motion' },
      },
    ]);
    expect(matters).toHaveLength(2);
    expect(matters[0].caseName).toMatch(/Head Kandy LLC v\. Mcneill/);
    expect(matters[1].caseName).toMatch(
      /Davis v\. Little Giant Ladder Systems LLC/,
    );
  });
});
