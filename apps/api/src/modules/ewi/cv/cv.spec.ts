import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import type { LoadedExpertDocument } from '../documents/expert-documents.types';
import {
  buildCvBatches,
  extractBibliographyClaims,
  finalizeCvClaims,
  formatCvBatch,
  parseCvReply,
  splitPageText,
  validateCvClaims,
} from './cv-claims';
import {
  compareCv,
  CV_LABEL_TEXT,
  cvComparisonCountSummary,
  cvDiscrepancies,
} from './cv-comparison';
import type { CvClaim, CvExtraction } from './cv.types';

const page1 =
  'JANE A. SMITH, MD. Board Certified, American Board of Neurological Surgery, 2006. Medical licenses: California A12345; Arizona 54321. Neurosurgeon at Barrow Neurological Institute, Phoenix.';
const page2 =
  'Author of more than 120 peer-reviewed publications. Smith J, Lee A. Migraine outcomes after cervical fusion. Spine 2015. Consultant, Medtronic (2016-2019).';

const document: LoadedExpertDocument = {
  id: 'doc-1',
  kind: 'cv',
  name: 'smith-cv.pdf',
  pageCount: 3,
  unreadablePages: [3],
  ocrPages: [],
  pages: [
    { pageNumber: 1, text: page1, ocrConfidence: null },
    { pageNumber: 2, text: page2, ocrConfidence: 81 },
    { pageNumber: 3, text: '', ocrConfidence: null },
  ],
};

describe('CV claims', () => {
  it('batches readable pages and marks OCR pages', () => {
    const batches = buildCvBatches(document, 12000);
    expect(batches).toHaveLength(1);
    expect(batches[0].pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    const text = formatCvBatch(batches[0]);
    expect(text).toContain('=== Page 1 ===\nJANE A. SMITH');
    expect(text).toContain('=== Page 2 ===\n[Scanned page: text read by OCR');
  });

  it('keeps quoted claims, fixes the page, and drops invented ones', () => {
    const [batch] = buildCvBatches(document, 12000);
    const reply = `\`\`\`json
{"claims": [
  {"category": "license", "statement": "Licensed in California", "details": {"state": "California", "licenseNumber": "A12345"}, "page": 2, "quote": "Medical licenses: California A12345"},
  {"category": "publications_count", "statement": "More than 120 publications", "details": {"count": "120+"}, "page": 2, "quote": "Author of more than 120 peer-reviewed publications"},
  {"category": "award", "statement": "Nobel Prize", "details": {"name": "Nobel Prize"}, "page": 1, "quote": "Awarded the Nobel Prize in Medicine in 2010"},
  {"category": "hobby", "statement": "Plays golf", "page": 1, "quote": "JANE A. SMITH, MD"}
]}
\`\`\``;
    const claims = finalizeCvClaims(
      validateCvClaims(parseCvReply(reply), batch),
    );
    expect(claims).toEqual([
      {
        id: 'cv-1',
        category: 'license',
        statement: 'Licensed in California',
        details: { state: 'CA', licenseNumber: 'A12345' },
        page: 1,
        quote: 'Medical licenses: California A12345',
      },
      {
        id: 'cv-2',
        category: 'publications_count',
        statement: 'More than 120 publications',
        details: { count: 120 },
        page: 2,
        quote: 'Author of more than 120 peer-reviewed publications',
      },
    ]);
  });
});

function claim(
  id: string,
  category: CvClaim['category'],
  statement: string,
  details: CvClaim['details'],
): CvClaim {
  return { id, category, statement, details, page: 1, quote: statement };
}

const identity: ExpertIdentityResolution = {
  status: 'confirmed',
  identity: {
    npi: '1234567893',
    name: 'Jane A. Smith, MD',
    credential: 'MD',
    taxonomy: 'Psychiatry & Neurology, Neurology',
    city: 'PHOENIX',
    state: 'AZ',
    url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
  },
  basis: ['name', 'practice city', 'specialty'],
  note: '',
  notes: [],
  candidates: [],
};

function item(
  sourceId: string,
  category: string,
  raw: Record<string, unknown>,
): ExpertEvidenceItem {
  return {
    sourceId,
    category,
    title: `${sourceId} ${category}`,
    summary: '',
    url: `https://example.org/${sourceId}`,
    identityMatch: 'matched',
    raw,
  };
}

const evidence: ExpertEvidenceItem[] = [
  item('npi_registry', 'identity', {
    taxonomies: [
      { description: 'Psychiatry & Neurology, Neurology', primary: true },
    ],
  }),
  item('npi_registry', 'license', {
    nppesLicenses: [
      { state: 'AZ', number: '54321' },
      { state: 'NV', number: '777' },
    ],
  }),
  item('openalex', 'profile', {
    worksCount: 38,
    institutions: ['Barrow Neurological Institute'],
  }),
  item('open_payments', 'income_bias', {
    openPaymentsSummary: true,
    programYears: [2019, 2025],
    topPayers: [
      { payer: 'Medtronic USA, Inc.', total: 5200, records: 12 },
      { payer: 'Teva Pharmaceuticals USA, Inc.', total: 12500.5, records: 40 },
      { payer: 'Small Co', total: 250, records: 3 },
    ],
  }),
  item('courtlistener', 'legal', { challenge: { outcome: 'not_determined' } }),
];

const sourceResults = [
  { sourceId: 'open_payments', status: 'ok' },
] as ExpertResearchSourceResult[];

const extraction: CvExtraction = {
  document: {
    id: 'doc-1',
    name: 'smith-cv.pdf',
    pageCount: 3,
    unreadablePages: [],
    ocrPages: [],
  },
  status: 'completed',
  warnings: [],
  claims: [
    claim('cv-1', 'specialty', 'Neurosurgeon', { specialty: 'Neurosurgery' }),
    claim('cv-2', 'license', 'California license', { state: 'CA' }),
    claim('cv-3', 'license', 'Arizona license', { state: 'AZ' }),
    claim('cv-4', 'board_certification', 'ABNS certified', {
      board: 'American Board of Neurological Surgery',
      specialty: 'Neurological Surgery',
    }),
    claim('cv-5', 'publications_count', 'Over 120 publications', {
      count: 120,
    }),
    claim('cv-6', 'publication', 'Migraine outcomes', {
      title: 'Migraine outcomes after cervical fusion',
    }),
    claim('cv-7', 'publication', 'Spine study', { title: 'Spine study title' }),
    claim('cv-8', 'publication', 'Missing paper', {
      title: 'A paper nobody indexed',
    }),
    claim('cv-9', 'industry_relationship', 'Consultant for Medtronic', {
      company: 'Medtronic',
    }),
    claim('cv-10', 'appointment', 'Neurosurgeon at Barrow', {
      institution: 'Barrow Neurological Institute',
    }),
    claim('cv-11', 'expert_witness', 'Reviewed 300 cases', { count: 300 }),
    claim('cv-12', 'education', 'MD, Harvard Medical School, 1998', {
      degree: 'MD',
    }),
  ],
};

const publications = [
  {
    title: 'Migraine outcomes after cervical fusion',
    status: 'authored' as const,
    work: {
      title: 'Migraine outcomes after cervical fusion',
      url: 'https://doi.org/1',
      year: 2015,
      authors: ['Jane A. Smith'],
    },
  },
  {
    title: 'Spine study title',
    status: 'not_author' as const,
    work: {
      title: 'Spine study title',
      url: 'https://doi.org/2',
      year: 2012,
      authors: ['Ann Lee', 'Bo Chen'],
    },
  },
  { title: 'A paper nobody indexed', status: 'not_found' as const },
];

describe('CV comparison', () => {
  const check = compareCv({
    extraction,
    evidence,
    sourceResults,
    identity,
    publications,
  });
  const byTitle = (text: string) =>
    check.comparisons.find((row) => row.title.includes(text));

  it('compares the specialty with the NPI taxonomy', () => {
    expect(byTitle('CV specialty')).toMatchObject({
      label: 'conflicting',
      severity: 'high',
      title:
        'CV specialty "Neurosurgery" does not match the NPI Registry taxonomy',
    });
  });

  it('compares licenses with NPPES both ways, never as verified', () => {
    expect(byTitle('License in California')).toMatchObject({
      label: 'not_found',
      severity: 'medium',
    });
    expect(byTitle('License in Arizona')).toMatchObject({
      label: 'partially_verified',
    });
    expect(byTitle('Nevada license the CV does not mention')).toMatchObject({
      label: 'not_verified',
      cv: null,
    });
  });

  it('checks the publication count and each listed title', () => {
    expect(
      byTitle('CV states 120 publications; OpenAlex lists 38'),
    ).toMatchObject({
      label: 'conflicting',
    });
    expect(byTitle('found with the expert as an author')?.label).toBe(
      'verified',
    );
    expect(byTitle('do not list the expert as an author')).toMatchObject({
      label: 'conflicting',
      severity: 'high',
    });
    expect(byTitle('not found in catalogs searched')?.label).toBe(
      'unable_to_verify',
    );
  });

  it('flags large undisclosed Open Payments and matches disclosed ones', () => {
    expect(byTitle('Disclosed relationship with Medtronic')?.label).toBe(
      'verified',
    );
    expect(
      byTitle(
        'from Teva Pharmaceuticals USA, Inc.; the CV does not mention it',
      ),
    ).toMatchObject({
      label: 'not_found',
      severity: 'high',
      title:
        'Open Payments shows $12,500.50 from Teva Pharmaceuticals USA, Inc.; the CV does not mention it',
    });
    expect(byTitle('Small Co')).toBeUndefined();
  });

  it('marks what no source can check as not checked', () => {
    expect(byTitle('Board certification')?.label).toBe('unable_to_verify');
    expect(byTitle('Affiliation with Barrow')?.label).toBe(
      'partially_verified',
    );
    expect(byTitle('Expert witness experience')?.source?.statement).toContain(
      '1 published opinion(s)',
    );
    expect(byTitle('MD, Harvard')?.label).toBe('unable_to_verify');
  });

  it('raises only conflicts and meaningful gaps as inconsistencies', () => {
    const discrepancies = cvDiscrepancies(check);
    expect(discrepancies.map((row) => row.label).sort()).toEqual([
      'conflicting',
      'conflicting',
      'conflicting',
      'not_found',
      'not_found',
    ]);
    expect(
      discrepancies.some((row) =>
        /not confirmed in the catalogs/i.test(row.title),
      ),
    ).toBe(false);
    expect(discrepancies[0].cvSource).toBe('Uploaded CV: smith-cv.pdf');
    expect(discrepancies.every((row) => row.evidenceIds.length > 0)).toBe(true);
    expect(discrepancies.every((row) => row.sources.length > 0)).toBe(true);
    expect(discrepancies[0].sources[0]?.sourceName).toBe(
      'Uploaded CV: smith-cv.pdf',
    );
  });

  it('does not compare licenses or payments without a confirmed identity', () => {
    const unconfirmed = compareCv({
      extraction,
      evidence,
      sourceResults: [],
      identity: { ...identity, status: 'ambiguous', identity: null },
      publications: [],
    });
    expect(
      unconfirmed.comparisons
        .filter((row) =>
          ['license', 'specialty', 'industry_relationship'].includes(row.topic),
        )
        .every((row) => row.label === 'unable_to_verify'),
    ).toBe(true);
  });

  it('does not treat membership or editorial CV text as publication citations', () => {
    const junk = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim(
            'cv-m',
            'publication',
            'SOCIETY MEMBERSHIPS American Psychological Association',
            {
              title: 'SOCIETY MEMBERSHIPS American Psychological Association',
            },
          ),
          claim(
            'cv-e',
            'publication',
            'Ad Hoc Reviewer, Journal of Pain and Symptom Management, from 2013',
            {
              title: 'Ad Hoc Reviewer, Journal of Pain',
            },
          ),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [],
    });
    expect(
      junk.comparisons.filter((row) => row.topic === 'publication'),
    ).toHaveLength(0);
  });

  it('keeps a CV publication that catalogs did not search, without calling it disproven', () => {
    const unsearched = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim('cv-p', 'publication', 'Unsearched paper', {
            title: 'A title that was never looked up',
          }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [
        { title: 'A title that was never looked up', status: 'unavailable' },
      ],
    });
    const row = unsearched.comparisons.find((item) =>
      item.title.includes('A title that was never looked up'),
    );
    expect(row?.label).toBe('unable_to_verify');
    expect(
      cvDiscrepancies(unsearched).filter(
        (item) => item.field === 'publication',
      ),
    ).toEqual([]);
  });

  it('reports unread CV pages without treating them as publication discrepancies', () => {
    const unread = compareCv({
      extraction: {
        ...extraction,
        status: 'partial',
        incompletePages: [6, 7, 8, 9],
        document: { ...extraction.document, pageCount: 9, unreadablePages: [] },
        claims: [
          claim('cv-p', 'publication', 'Kept paper', {
            title: 'A paper nobody indexed',
          }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [{ title: 'A paper nobody indexed', status: 'not_found' }],
    });
    const pages = unread.comparisons.filter((row) =>
      row.title.startsWith('CV page unread or partially extracted'),
    );
    expect(pages.map((row) => row.title)).toEqual([
      'CV page unread or partially extracted: page 6',
      'CV page unread or partially extracted: page 7',
      'CV page unread or partially extracted: page 8',
      'CV page unread or partially extracted: page 9',
    ]);
    expect(pages.every((row) => row.label === 'unable_to_verify')).toBe(true);
    expect(
      cvDiscrepancies(unread).filter((item) => item.field === 'publication'),
    ).toEqual([]);
  });

  it('flags a verified first-author discrepancy when the catalog author order differs', () => {
    const check = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim(
            'cv-p',
            'publication',
            'Ellenberg L, Smith J (1999). Memory after pediatric TBI.',
            {
              title: 'Memory after pediatric TBI',
              year: '1999',
              publicationType: 'article',
            },
          ),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [
        {
          title: 'Memory after pediatric TBI',
          status: 'authored',
          catalog: 'PubMed',
          pmid: '11111111',
          publicationType: 'article',
          work: {
            title: 'Memory after pediatric TBI',
            url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
            year: 1999,
            authors: ['Smith J', 'Ellenberg L'],
          },
          authorPosition: 'last',
          authorIndex: 1,
          authorCount: 2,
          cvAuthorPosition: 'first',
          cvAuthorCount: 2,
          positionCheck: 'differs',
          authorListIncomplete: false,
        },
      ],
      expertName: 'Leah Ellenberg',
    });
    const row = check.comparisons.find((item) =>
      item.title.includes('Memory after pediatric TBI'),
    );
    expect(row?.label).toBe('conflicting');
    expect(row?.title).toMatch(/author position differs/i);
    expect(row?.note).toMatch(/first/i);
    expect(
      cvDiscrepancies(check).some((item) => item.field === 'publication'),
    ).toBe(true);
  });

  it('records a truncated author list as verified authorship with position not verifiable', () => {
    const check = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim('cv-p', 'publication', 'Axial movements', {
            title: 'Axial movements are relatively preserved',
            publicationType: 'article',
          }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [
        {
          title: 'Axial movements are relatively preserved',
          status: 'authored',
          catalog: 'OpenAlex',
          doi: '10.1000/axial',
          publicationType: 'article',
          work: {
            title: 'Axial movements are relatively preserved',
            url: 'https://doi.org/10.1000/axial',
            year: 1998,
            authors: ['Robert E. Hanlon', 'Jason A. Demery'],
          },
          authorPosition: 'middle',
          authorIndex: 1,
          authorCount: 2,
          positionCheck: 'not_verifiable',
          authorListIncomplete: true,
        },
      ],
    });
    const row = check.comparisons.find((item) =>
      item.title.includes('Axial movements'),
    );
    expect(row?.label).toBe('partially_verified');
    expect(row?.title).toMatch(/author position not verifiable/i);
    expect(row?.source?.url).toBe('https://doi.org/10.1000/axial');
    expect(row?.note).toMatch(/Author position not verifiable/);
    expect(
      cvDiscrepancies(check).filter((item) => item.field === 'publication'),
    ).toEqual([]);
  });

  it('does not treat a chapter catalog miss as a journal-article discrepancy', () => {
    const check = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim('cv-p', 'publication', 'A book chapter', {
            title: 'Neuropsychology of traumatic brain injury in adults',
            publicationType: 'chapter',
          }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [
        {
          title: 'Neuropsychology of traumatic brain injury in adults',
          status: 'not_found',
          publicationType: 'chapter',
        },
      ],
    });
    const row = check.comparisons.find((item) =>
      item.title.includes('Neuropsychology of traumatic brain injury'),
    );
    expect(row?.label).toBe('unable_to_verify');
    expect(row?.title).toMatch(/not found in catalogs searched/i);
    expect(row?.note).toMatch(
      /often not indexed as a peer-reviewed journal article/,
    );
    expect(
      cvDiscrepancies(check).filter((item) => item.field === 'publication'),
    ).toEqual([]);
  });

  it('does not duplicate a publication comparison for the same title', () => {
    const duplicated = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim('cv-a', 'publication', 'GFAP first', {
            title:
              'Serum GFAP and UCH-L1 for prediction of neurological outcomes',
          }),
          claim('cv-b', 'publication', 'GFAP again', {
            title:
              'Serum GFAP and UCH-L1 for prediction of neurological outcomes',
          }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [
        {
          title:
            'Serum GFAP and UCH-L1 for prediction of neurological outcomes',
          status: 'not_found',
        },
      ],
    });
    expect(
      duplicated.comparisons.filter((row) => row.topic === 'publication'),
    ).toHaveLength(1);
    expect(
      cvDiscrepancies(duplicated).filter(
        (item) => item.field === 'publication',
      ),
    ).toEqual([]);
  });

  it('uses a collected PubMed record when catalog title search missed the same citation', () => {
    const check = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim(
            'cv-p',
            'publication',
            'Ellenberg L (1999). Memory after pediatric TBI. JINS, 5, 139.',
            {
              title: 'Memory after pediatric TBI',
              year: '1999',
              journal: 'JINS',
            },
          ),
        ],
      },
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI.',
          summary: 'PubMed lists Memory after pediatric TBI.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
          identityMatch: 'matched',
          raw: {
            pmid: '11111111',
            doi: '10.1000/ellenberg-memory',
            authors: ['Ellenberg L', 'Smith J'],
            authorPosition: 'first',
            authorIndex: 0,
            authorCount: 2,
            journal: 'JINS',
            pubdate: '1999 Jan',
          },
        },
      ],
      sourceResults,
      identity,
      publications: [
        { title: 'Memory after pediatric TBI', status: 'not_found' },
      ],
      expertName: 'Leah Ellenberg',
    });
    const row = check.comparisons.find((item) =>
      item.title.includes('Memory after pediatric TBI'),
    );
    expect(row?.label).toBe('verified');
    expect(row?.source?.url).toBe('https://pubmed.ncbi.nlm.nih.gov/11111111/');
    expect(row?.note).toMatch(/first of 2/);
    expect(row?.title).not.toMatch(/not confirmed in the catalogs/i);
  });

  it('accounts for every extracted claim in the comparison counts', () => {
    const check = compareCv({
      extraction: {
        ...extraction,
        claims: [
          claim('cv-p', 'publication', 'A listed paper', {
            title: 'A listed paper',
          }),
          claim('cv-m', 'membership', 'AACN member', { name: 'AACN' }),
          claim('cv-a', 'award', 'Dean scholarship', { name: 'Dean' }),
        ],
      },
      evidence,
      sourceResults,
      identity,
      publications: [{ title: 'A listed paper', status: 'not_found' }],
    });
    const compared = new Set(
      check.comparisons
        .map((row) => row.cv?.claimId)
        .filter((id): id is string => Boolean(id)),
    );
    expect([...compared].sort()).toEqual(['cv-a', 'cv-m', 'cv-p']);
    expect(
      check.comparisons.filter((row) => row.cv?.claimId === 'cv-p')[0]?.label,
    ).toBe('unable_to_verify');
    expect(
      check.comparisons.filter((row) => row.label === 'unable_to_verify'),
    ).toHaveLength(3);
    const summary = cvComparisonCountSummary(check);
    expect(summary).toMatch(/3 unique CV claim\(s\) were read/);
    expect(summary).toMatch(
      /Unique CV claims \(3\) = compared \(3\) \+ uncompared \(0\)/,
    );
    expect(summary).toMatch(/No matching source: 3/);
    expect(CV_LABEL_TEXT.verified).toBe('Consistent');
    expect(CV_LABEL_TEXT.conflicting).toBe('Discrepancy identified');
    expect(CV_LABEL_TEXT.partially_verified).toBe('Possible match');
    expect(CV_LABEL_TEXT.unable_to_verify).toBe('No matching source');
  });
});

describe('extractBibliographyClaims', () => {
  it('keeps numbered publications and labels abstracts instead of dropping them', () => {
    const page =
      'PUBLICATIONS 1. Hanlon RE, Demery JA (1998). Axial movements are relatively preserved. Cortex, 34, 731-741. doi:10.1000/axial. 2. Demery JA (2001). Profound amnesia and confabulation following traumatic brain injury. Neurocase, 7, 295-302. PUBLISHED ABSTRACTS 1. Demery JA (1999). A poster that is not a journal article. Journal of the International Neuropsychological Society, 5, 139.';
    const claims = extractBibliographyClaims([{ pageNumber: 7, text: page }]);
    expect(claims).toHaveLength(3);
    expect(claims[0].details).toMatchObject({
      title: 'Axial movements are relatively preserved',
      publicationType: 'article',
      doi: '10.1000/axial',
      year: '1998',
    });
    expect(claims[1].details.title).toBe(
      'Profound amnesia and confabulation following traumatic brain injury',
    );
    expect(claims[2].details).toMatchObject({
      publicationType: 'abstract',
      title: 'A poster that is not a journal article',
    });
  });

  it('splits a long CV page so later publications are not dropped', () => {
    const page = `${'Publication line. '.repeat(400)}End of page six.`;
    expect(page.length).toBeGreaterThan(5000);
    const chunks = splitPageText(page, 5000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('End of page six.');
    const batches = buildCvBatches(
      {
        ...document,
        pageCount: 1,
        unreadablePages: [],
        pages: [{ pageNumber: 6, text: page, ocrConfidence: null }],
      },
      5000,
    );
    expect(batches.flatMap((batch) => batch.pages).length).toBe(chunks.length);
    expect(
      batches
        .flatMap((batch) => batch.pages)
        .every((item) => item.pageNumber === 6),
    ).toBe(true);
  });
});
