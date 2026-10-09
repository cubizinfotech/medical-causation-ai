import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import type { LoadedExpertDocument } from '../documents/expert-documents.types';
import {
  buildCvBatches,
  finalizeCvClaims,
  formatCvBatch,
  parseCvReply,
  validateCvClaims,
} from './cv-claims';
import { compareCv, cvDiscrepancies } from './cv-comparison';
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
    expect(byTitle('expert is not listed as an author')).toMatchObject({
      label: 'conflicting',
      severity: 'high',
    });
    expect(byTitle('not found in OpenAlex')?.label).toBe('not_found');
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
      'not_found',
    ]);
    expect(discrepancies[0].cvSource).toBe('Uploaded CV: smith-cv.pdf');
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
});
