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

  it('puts the NPI record in background and its licenses under Licenses', () => {
    expect(sectionText(document, 'background')).toMatch(
      /NPI Registry: Jane A\. Smith, MD/,
    );
    const licenses = sectionText(document, 'licenses');
    expect(licenses).toMatch(/Licenses reported to the NPI Registry/);
    expect(licenses).toMatch(/AZ 12345 \(primary\)/);
  });

  it('shows the identity result in the background section', () => {
    const text = sectionText(document, 'background');
    expect(text).toMatch(
      /Identity not confirmed — several possible NPI records/,
    );
    expect(text).toMatch(
      /Possible record: NPI 1234567893 — Jane A\. Smith, MD/,
    );
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
