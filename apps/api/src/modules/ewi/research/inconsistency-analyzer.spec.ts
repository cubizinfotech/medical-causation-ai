import { DiscrepancyAnalyzer } from './discrepancy-analyzer';
import { analyzeInconsistencies } from './inconsistency-analyzer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { VerificationAttempt } from './inconsistency-analyzer';

function item(
  partial: Pick<ExpertEvidenceItem, 'sourceId' | 'category' | 'title'> &
    Partial<ExpertEvidenceItem>,
): ExpertEvidenceItem {
  return {
    summary: 'Collected statement',
    ...partial,
  };
}

const NEUTRAL = /fraudulent|falsif|fabricat|\bfalse\b/i;

describe('CV comparison', () => {
  it('keeps a chronological comparison when graduation years differ', () => {
    const rows = analyzeInconsistencies([
      item({
        sourceId: 'cv_profile',
        category: 'cv',
        title: 'CV 2018',
        url: 'https://example.local/cv-2018',
        retrievedAt: '2018-03-01T00:00:00.000Z',
        raw: {
          cvDate: '2018-03-01',
          cvSource: 'CV dated March 2018',
          claims: [
            { field: 'graduation_date', value: '1998', subject: 'M.D.' },
          ],
        },
      }),
      item({
        sourceId: 'cv_profile',
        category: 'cv',
        title: 'CV 2024',
        url: 'https://example.local/cv-2024',
        retrievedAt: '2024-01-15T00:00:00.000Z',
        raw: {
          cvDate: '2024-01-15',
          cvSource: 'CV dated January 2024',
          claims: [
            { field: 'graduation_date', value: '2001', subject: 'M.D.' },
          ],
        },
      }),
      item({
        sourceId: 'education_verification',
        category: 'education',
        title: 'Registrar note',
        url: 'https://example.local/registrar',
        raw: {
          claims: [
            {
              field: 'graduation_date',
              value: '1998',
              subject: 'M.D.',
              role: 'record',
            },
          ],
        },
      }),
    ]);

    const row = rows.find((entry) => entry.field === 'graduation_date');
    expect(row).toMatchObject({
      label: 'conflicting',
      severity: 'high',
      previousValue: '1998',
      currentValue: '2001',
      cvDate: '2024-01-15',
      cvSource: 'CV dated January 2024',
      supportingSource: 'Registrar note',
      change: 'Graduation date differs between CV versions.',
    });
    expect(row?.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        'https://example.local/cv-2018',
        'https://example.local/cv-2024',
        'https://example.local/registrar',
      ]),
    );
    expect(row?.description).not.toMatch(NEUTRAL);
  });

  it('does not treat a same-name uncertain record as another CV version', () => {
    const rows = analyzeInconsistencies([
      item({
        sourceId: 'cv_profile',
        category: 'cv',
        title: 'CV',
        raw: {
          cvDate: '2020-01-01',
          claims: [
            { field: 'graduation_date', value: '1998', subject: 'M.D.' },
          ],
        },
      }),
      item({
        sourceId: 'web_search',
        category: 'profile',
        title: 'Other city',
        identityMatch: 'uncertain',
        raw: {
          cvDate: '2021-01-01',
          claims: [
            { field: 'graduation_date', value: '1970', subject: 'M.D.' },
          ],
        },
      }),
    ]);

    expect(rows.some((entry) => entry.label === 'conflicting')).toBe(false);
  });
});

describe('conflicting and unverified evidence', () => {
  const attempts: VerificationAttempt[] = [
    {
      providerId: 'state_license',
      status: 'ok',
      outcome: 'success',
      itemCount: 1,
    },
    {
      providerId: 'grants',
      status: 'no_result',
      outcome: 'no_result',
      itemCount: 0,
    },
    {
      providerId: 'university_accreditation',
      status: 'unavailable',
      outcome: 'unavailable',
      itemCount: 0,
    },
    {
      providerId: 'awards',
      status: 'no_result',
      outcome: 'no_result',
      itemCount: 0,
    },
    {
      providerId: 'board_certification',
      status: 'unavailable',
      outcome: 'unavailable',
      itemCount: 0,
    },
    { providerId: 'pubmed', status: 'ok', outcome: 'success', itemCount: 1 },
  ];

  it('labels disagreements and unverified claims without treating them as fraud', () => {
    const rows = analyzeInconsistencies(
      [
        item({
          sourceId: 'cv_profile',
          category: 'cv',
          title: 'CV',
          url: 'https://example.local/cv',
          raw: {
            cvDate: '2022-06-01',
            cvSource: 'CV dated June 2022',
            claims: [
              { field: 'license_date', value: '2001-04-01', subject: 'NY' },
              { field: 'specialty', value: 'Neurology' },
              {
                field: 'publication',
                value: 'Stroke outcomes 2010',
                subject: 'Stroke outcomes 2010',
              },
              {
                field: 'lead_author',
                value: 'first',
                subject: 'Stroke outcomes 2010',
              },
              {
                field: 'grant',
                value: 'NIH R01 NS000',
                subject: 'NIH R01 NS000',
              },
              {
                field: 'membership',
                value: 'AAN Fellow',
                subject: 'AAN Fellow',
              },
              { field: 'certification_organization', value: 'ABIM' },
              {
                field: 'university_accreditation',
                value: 'Regional accreditation',
                subject: 'State University',
              },
              { field: 'award', value: 'Silver Star', subject: 'Silver Star' },
              {
                field: 'military',
                value: 'Bronze Star',
                subject: 'Bronze Star',
              },
              {
                field: 'publication',
                value: 'Unlisted chapter',
                subject: 'Unlisted chapter',
              },
            ],
          },
        }),
        item({
          sourceId: 'state_license',
          category: 'license',
          title: 'NY license record',
          url: 'https://example.local/license',
          raw: { state: 'NY', licenseDate: '2004-04-01', status: 'lapsed' },
        }),
        item({
          sourceId: 'cv_profile',
          category: 'cv',
          title: 'Earlier CV',
          raw: {
            cvDate: '2016-01-01',
            cvSource: 'CV dated January 2016',
            claims: [{ field: 'specialty', value: 'Internal Medicine' }],
          },
        }),
        item({
          sourceId: 'pubmed',
          category: 'publication',
          title: 'PubMed lookup',
          url: 'https://example.local/pubmed',
          raw: {
            claims: [
              {
                field: 'publication',
                value: 'Stroke outcomes 2010',
                subject: 'Stroke outcomes 2010',
                found: false,
                role: 'record',
              },
            ],
          },
        }),
        item({
          sourceId: 'author_verification',
          category: 'publication',
          title: 'Author order',
          raw: {
            publication: 'Stroke outcomes 2010',
            authorPosition: 'co-author',
          },
        }),
        item({
          sourceId: 'certification_organization',
          category: 'board_certification',
          title: 'Certifying body',
          raw: { certificationOrganization: 'ABPN' },
        }),
      ],
      attempts,
    );

    expect(rows.map((entry) => `${entry.field}:${entry.label}`)).toEqual(
      expect.arrayContaining([
        'license_date:conflicting',
        'specialty:conflicting',
        'publication:not_found',
        'lead_author:conflicting',
        'grant:not_found',
        'membership:unable_to_verify',
        'certification_organization:conflicting',
        'university_accreditation:unable_to_verify',
        'award:not_found',
        'military:unable_to_verify',
        'publication:not_verified',
      ]),
    );

    const license = rows.find((entry) => entry.field === 'license_date');
    expect(license).toMatchObject({
      previousValue: '2001-04-01',
      currentValue: '2004-04-01',
      severity: 'high',
    });
    expect(license?.sources.map((source) => source.sourceId)).toEqual(
      expect.arrayContaining(['cv_profile', 'state_license']),
    );

    const author = rows.find((entry) => entry.field === 'lead_author');
    expect(author?.label).toBe('conflicting');
    expect(author?.description).toMatch(/not lead|co-author/i);
    expect(author?.description).not.toMatch(NEUTRAL);

    expect(
      rows.some(
        (entry) => entry.severity === 'low' && rows[0].severity === 'high',
      ),
    ).toBe(true);
    expect(rows[0]?.severity).toBe('high');
    expect(rows.map((entry) => entry.description).join(' ')).not.toMatch(
      NEUTRAL,
    );
  });

  it('records a lapsed license from the collected status', () => {
    const rows = analyzeInconsistencies([
      item({
        sourceId: 'state_license',
        category: 'license',
        title: 'Board record',
        url: 'https://example.local/board',
        raw: { state: 'CA', status: 'lapsed' },
      }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        field: 'license_status',
        label: 'not_verified',
        severity: 'high',
        currentValue: 'lapsed',
        title: 'License status is recorded as lapsed',
      }),
    ]);
    expect(rows[0]?.sources[0]?.url).toBe('https://example.local/board');
  });
});

describe('DiscrepancyAnalyzer', () => {
  const analyzer = new DiscrepancyAnalyzer();

  it('flags publication count gaps from collected counts', () => {
    const items: ExpertEvidenceItem[] = [
      {
        sourceId: 'mock',
        category: 'publication',
        title: 'CV list',
        summary: 'gap',
        raw: { cvCount: 42, indexedCount: 38 },
      },
    ];

    const result = analyzer.analyze(items);
    expect(result.some((entry) => entry.id === 'publication-count-gap')).toBe(
      true,
    );
    expect(
      result.find((entry) => entry.id === 'publication-count-gap')?.label,
    ).toBe('partially_verified');
  });

  it('does not invent a discrepancy when statements do not conflict', () => {
    const items: ExpertEvidenceItem[] = [
      {
        sourceId: 'mock',
        category: 'profile',
        title: 'Profile',
        summary: 'ok',
      },
    ];

    expect(analyzer.analyze(items)).toEqual([]);
  });
});
