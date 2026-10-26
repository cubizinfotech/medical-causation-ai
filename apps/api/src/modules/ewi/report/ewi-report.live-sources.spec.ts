import type { ExpertEvidenceItem } from '@integrations/expert-research';
import { buildEwiReportDocument } from './ewi-report.template';

function sectionText(
  document: ReturnType<typeof buildEwiReportDocument>,
  id: string,
): string {
  return (
    document.sections
      .find((section) => section.id === id)
      ?.blocks.map((block) => block.text)
      .join('\n') ?? ''
  );
}

const ruling: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Doe v. Roe (2020)',
  summary: 'Opinion with challenge language.',
  url: 'https://www.courtlistener.com/opinion/1/doe-v-roe/',
  identityMatch: 'matched',
  raw: {
    documentType: 'expert_witness_case',
    caseName: 'Doe v. Roe',
    court: 'District Court, D. Arizona',
    citation: '2020 WL 1',
    documentDate: '2020-02-03',
    evidenceReference: 'Doe v. Roe, 2020 WL 1 (2020-02-03)',
    challenge: {
      standard: 'daubert',
      outcome: 'excluded',
      role: 'challenged_expert',
      quote: 'the motion to exclude Dr. Smith is GRANTED',
      basis: 'court_text',
      excerpts: ['... the motion to exclude Dr. Smith is GRANTED ...'],
      excerptSource: 'opinion_text',
    },
  },
};

const mention: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Poe v. Hospital (2018)',
  summary: 'Opinion that names the expert.',
  url: 'https://www.courtlistener.com/opinion/2/poe-v-hospital/',
  identityMatch: 'matched',
  raw: {
    documentType: 'case',
    caseName: 'Poe v. Hospital',
    documentDate: '2018-05-01',
    caseNumber: '2:18-cv-9',
    docketCoverage: 'opinion_only',
  },
};

const payments = (title: string, date: string): ExpertEvidenceItem => ({
  sourceId: 'open_payments',
  category: 'income_bias',
  title,
  summary: `${title} summary`,
  url: 'https://openpaymentsdata.cms.gov/physician/718136',
  identityMatch: 'matched',
  informationStatus: 'verified',
  raw: { professionalKind: 'open_payments', date },
});

describe('EWI report CV comparison', () => {
  it('lists conflicts first with the CV quote and the source', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Smith',
      city: 'Phoenix',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'cv_profile',
          category: 'cv',
          title: 'Expert CV: smith-cv.pdf',
          summary: '2 claim(s) read from the uploaded CV.',
          identityMatch: 'matched',
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-09T00:00:00.000Z',
      cvCheck: {
        document: {
          id: 'doc-1',
          name: 'smith-cv.pdf',
          pageCount: 4,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [],
        warnings: [],
        comparisons: [
          {
            id: 'cvc-1',
            topic: 'education',
            label: 'unable_to_verify',
            severity: 'low',
            title: 'MD, Harvard Medical School, 1998',
            cv: { statement: 'MD, Harvard Medical School, 1998', page: 1 },
            source: null,
            note: 'No education source is connected.',
          },
          {
            id: 'cvc-2',
            topic: 'publication',
            label: 'conflicting',
            severity: 'high',
            title:
              'Publication found, but the expert is not listed as an author: Spine study',
            cv: {
              statement: 'Spine study',
              page: 3,
              quote: 'Spine study. Spine 2012.',
            },
            source: {
              name: 'OpenAlex',
              statement: 'Spine study (2012). Authors: Ann Lee.',
              url: 'https://doi.org/2',
            },
            note: 'Check the published author list.',
          },
        ],
      },
    });
    const text = sectionText(document, 'cv-comparison');
    expect(text).toMatch(/Uploaded CV: smith-cv\.pdf \(4 pages\)/);
    expect(text).toMatch(/Discrepancy found: 1; Not searched: 1/);
    expect(text.indexOf('[Discrepancy found]')).toBeLessThan(
      text.indexOf('[Not searched]'),
    );
    expect(text).toContain('CV (page 3): “Spine study. Spine 2012.”');
    expect(text).toContain('OpenAlex: Spine study (2012). Authors: Ann Lee.');
    expect(text).toContain('https://doi.org/2');
    expect(text).toMatch(
      /missing catalog result is not a confirmed discrepancy/,
    );
    expect(text).toMatch(/readable pages of the uploaded CV were reviewed/);
    // The CV finding is not repeated under miscellaneous findings.
    expect(sectionText(document, 'misc')).not.toContain('Expert CV');
  });

  it('prints verification statuses, source URLs, and unread CV pages', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Smith',
      city: 'Phoenix',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-09T00:00:00.000Z',
      cvCheck: {
        document: {
          id: 'doc-1',
          name: 'smith-cv.pdf',
          pageCount: 9,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'partial',
        claims: [],
        warnings: [
          'CV page(s) unread or partially extracted: 6, 7, 8, 9. The CV was not fully reviewed.',
        ],
        incompletePages: [6, 7, 8, 9],
        comparisons: [
          {
            id: 'cvc-1',
            topic: 'publication',
            label: 'verified',
            severity: 'low',
            title:
              'Verified match. Publication found with the expert as an author (first of 2 authors): Migraine outcomes after cervical fusion',
            cv: {
              statement: 'Migraine outcomes after cervical fusion',
              page: 2,
              quote: 'Smith J, Lee A. Migraine outcomes after cervical fusion.',
            },
            source: {
              name: 'Crossref',
              statement:
                'Migraine outcomes after cervical fusion (2015). Authors: Jane A. Smith, Ann Lee. Catalog record type: journal article. DOI 10.1000/xyz',
              url: 'https://doi.org/10.1000/xyz',
            },
            note: 'The CV position matches the catalog.',
          },
          {
            id: 'cvc-2',
            topic: 'publication',
            label: 'not_verified',
            severity: 'low',
            title:
              'Not confirmed by available sources. Publication not confirmed in the catalogs searched: A paper nobody indexed',
            cv: {
              statement: 'A paper nobody indexed',
              page: 6,
              quote: 'A paper nobody indexed',
            },
            source: {
              name: 'OpenAlex, Crossref, PubMed',
              statement:
                'No matching work in OpenAlex, Crossref, PubMed. Absence from these catalogs is not proof the citation is false.',
            },
            note: 'This is not a finding that the publication is fabricated.',
          },
          {
            id: 'cvc-3',
            topic: 'publication',
            label: 'unable_to_verify',
            severity: 'low',
            title: 'CV page unread or partially extracted: page 6',
            cv: { statement: 'CV page 6 was not fully read.', page: 6 },
            source: null,
            note: 'The CV was not fully reviewed.',
          },
        ],
      },
    });
    const text = sectionText(document, 'cv-comparison');
    expect(text).toMatch(/The CV was not fully reviewed/);
    expect(text).toMatch(/Unread or partially extracted pages: 6, 7, 8, 9/);
    expect(text).toMatch(/Verified match/);
    expect(text).toMatch(/Not confirmed by available sources/);
    expect(text).toMatch(/CV page unread or partially extracted: page 6/);
    expect(text).toContain('https://doi.org/10.1000/xyz');
    expect(text).not.toMatch(/fabricated publication/);
  });
});

describe('EWI report with live sources', () => {
  const document = buildEwiReportDocument({
    expertName: 'Jane Smith',
    city: 'Phoenix',
    specialty: 'Neurology',
    evidence: [
      {
        sourceId: 'npi_registry',
        category: 'identity',
        title: 'NPI Registry: Jane A. Smith, MD (NPI 1234567893)',
        summary: 'The NPI Registry lists Jane A. Smith, MD.',
        identityMatch: 'matched',
        informationStatus: 'verified',
      },
      {
        sourceId: 'npi_registry',
        category: 'license',
        title: 'Licenses reported to the NPI Registry (NPI 1234567893)',
        summary:
          'AZ 12345 (primary). These licenses were reported by the clinician to NPPES, which does not verify them. Confirm each license with the state medical board.',
        identityMatch: 'matched',
        informationStatus: 'unverified',
        raw: { verificationStatus: 'nppes_self_reported' },
      },
      ruling,
      mention,
      payments('Open Payments: Acme — $1,000.40 (2018)', '2018'),
      payments(
        'CMS Open Payments 2019–2025: $1,020.60 from 2 companies',
        '2019',
      ),
    ],
    discrepancies: [],
    questions: [],
    generatedAt: '2026-10-08T00:00:00.000Z',
    identity: {
      status: 'ambiguous',
      identity: null,
      basis: [],
      note: '2 NPI Registry records match. Identity was not confirmed.',
      notes: [],
      candidates: [
        {
          npi: '1234567893',
          name: 'Jane A. Smith, MD',
          credential: 'MD',
          taxonomy: 'Neurology',
          city: 'PHOENIX',
          state: 'AZ',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
        },
      ],
    },
  });

  it('does not treat a possible NPI record as a verified identity or license', () => {
    const background = sectionText(document, 'background');
    expect(background).toMatch(
      /Identity not confirmed — one possible NPI record/,
    );
    expect(background).toMatch(/Possible record: NPI 1234567893/);
    expect(background).toMatch(/registry city PHOENIX/);
    expect(background).toMatch(/not a confirmed identity/i);
    expect(background).not.toMatch(/Status: Verified/);
    const licenses = sectionText(document, 'licenses');
    expect(licenses).not.toMatch(/Licenses reported to the NPI Registry/);
    expect(licenses).not.toMatch(/AZ 12345 \(primary\)/);
  });

  it('lists admissibility challenges with the court’s words', () => {
    const text = sectionText(document, 'admissibility-challenges');
    expect(text).toMatch(/1 opinion\(s\): Excluded 1\./);
    expect(text).toMatch(/Standard: Daubert/);
    expect(text).toMatch(
      /Excluded — the court’s words: “the motion to exclude Dr\. Smith is GRANTED”/,
    );
    // The challenge opinion is not repeated under lawsuits.
    const lawsuits = sectionText(document, 'lawsuits');
    expect(lawsuits).toMatch(/complete case docket/);
    expect(lawsuits).toMatch(/Poe v\. Hospital/);
    expect(lawsuits).not.toMatch(/Doe v\. Roe/);
  });

  it('puts the Open Payments totals before the per-company records', () => {
    const text = sectionText(document, 'income-bias');
    expect(text.indexOf('CMS Open Payments 2019–2025')).toBeLessThan(
      text.indexOf('Open Payments: Acme'),
    );
  });
});
