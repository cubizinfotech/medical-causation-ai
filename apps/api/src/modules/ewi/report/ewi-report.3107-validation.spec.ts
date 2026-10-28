/**
 * 3.10.7 fixture validation: rendered PDF and source-links, no live APIs.
 * Fixture CV claims are labelled as such; they are not a real CV verification.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PdfParser } from '@modules/document-processing/parsers/pdf.parser';
import { PdfReportRenderer } from '@platform/report/pdf/pdf-report.renderer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import { extractFacts } from '@integrations/web-research/claim-topics';
import { routeWebFindings } from '@integrations/web-research/section-router';
import { subjectFromQuery } from '@integrations/web-research/identity-assess';
import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import { compareCv } from '../cv/cv-comparison';
import type { CvClaim } from '../cv/cv.types';
import { buildLegalResearchDossier } from '../research/legal';
import { EwiPdfReportService } from './ewi-pdf-report.service';
import { prepareEwiReportInput } from './ewi-report-input';
import { buildEwiReportDocument } from './ewi-report.template';
import { uniqueSourceLinks } from './ewi-source-links';
import { EWI_REPORT_TEMPLATE_VERSION } from './ewi-report.version';

async function pdfText(buffer: Buffer): Promise<string> {
  const parsed = await new PdfParser().parse({
    filePath: 'fixture.pdf',
    buffer,
    filename: 'fixture.pdf',
    extension: 'pdf',
    fileSize: buffer.byteLength,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });
  return parsed.pages.map((page) => page.text).join('\n');
}

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

function webRecord(
  over: Partial<WebRecord> &
    Pick<WebRecord, 'id' | 'url' | 'title' | 'kind' | 'read'>,
): WebRecord {
  return {
    snippet: null,
    summary: over.title,
    publishedAt: null,
    retrievedAt: '2026-10-26T12:00:00.000Z',
    searchProviders: [],
    queries: [],
    readNote: null,
    match: {
      level: 'strong',
      confidence: 'high',
      basis: ['name'],
      conflicts: [],
      quote: 'Jason A. Demery',
      quoteVerified: true,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims: [],
    ...over,
  };
}

function dossier(records: WebRecord[]): WebResearchDossier {
  return {
    ranAt: '2026-10-26T12:00:00.000Z',
    durationMs: 1,
    partial: false,
    partialNote: null,
    queriesPlanned: 1,
    queriesRun: 1,
    providers: [],
    pagesRead: records.filter((record) => record.read === 'read').length,
    pagesBlocked: [],
    candidates: [],
    records,
    registries: [],
    limitations: [],
  };
}

const strongSite = webRecord({
  id: 'practice',
  url: 'https://neuropsychologicalsciences.com/about',
  title: 'About Dr. Demery',
  kind: 'expert_website',
  read: 'read',
});
const possibleDir = webRecord({
  id: 'possible-dir',
  url: 'https://www.expertinstitute.com/experts/other-jason/',
  title: 'Jason Other, PhD',
  kind: 'directory',
  read: 'snippet_only',
  snippet: 'Jason Other neuropsychologist',
  match: {
    level: 'possible',
    confidence: 'medium',
    basis: ['surname'],
    conflicts: [],
    quote: null,
    quoteVerified: false,
    classifiedBy: 'rules',
  },
  candidateId: 'cand-possible',
});
const otherPerson = webRecord({
  id: 'leila',
  url: 'https://psychologytoday.com/leila-glass',
  title: 'Leila Glass, PhD',
  kind: 'directory',
  read: 'read',
  match: {
    level: 'other_person',
    confidence: 'medium',
    basis: ['different first name'],
    conflicts: ['Leila Glass'],
    quote: 'Leila Glass, PhD',
    quoteVerified: true,
    classifiedBy: 'rules',
  },
});
const weakPage = webRecord({
  id: 'weak',
  url: 'https://news.example/demery-mentioned',
  title: 'A Demery mentioned',
  kind: 'news',
  read: 'snippet_only',
  match: {
    level: 'weak',
    confidence: 'low',
    basis: ['surname only'],
    conflicts: [],
    quote: 'Demery',
    quoteVerified: false,
    classifiedBy: 'rules',
  },
});

const pubmed: ExpertEvidenceItem = {
  sourceId: 'pubmed',
  category: 'publication',
  title: 'Cognitive outcomes after mild TBI',
  summary: 'PubMed catalog record.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/?utm_source=report',
  identityMatch: 'matched',
  informationStatus: 'unverified',
};

const uncertainCourt: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Unrelated v. Case',
  summary: 'Search hit; first and last name not in the retrieved excerpt.',
  url: 'https://www.courtlistener.com/opinion/999/unrelated/',
  identityMatch: 'uncertain',
  raw: {
    identity: {
      ambiguous: true,
      basis: ['search hit; first and last name not in the retrieved excerpt'],
    },
    documentType: 'case',
    retrievalStatus: 'snippet_only',
  },
};

const motion: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'motion',
  title: 'MOTION to Exclude — Roberts v. Example (2023)',
  summary:
    'This public motion contains Jason A. Demery. Whether the challenge was about this expert, and how the court ruled, is reported only when the court’s words say so. Only a search snippet was available.',
  url: 'https://www.courtlistener.com/docket/1/roberts-motion/',
  identityMatch: 'matched',
  raw: {
    documentType: 'motion',
    caseName: 'Roberts v. Example',
    findingsRegardingExpert:
      'Not determined from the search result. Read the document.',
    retrievalStatus: 'snippet_only',
    challenge: {
      standard: 'daubert',
      outcome: 'not_determined',
      role: 'unclear',
      quote: null,
      basis: 'not_determined',
      excerpts: ['Defendant files this motion to exclude Dr. Jason A. Demery.'],
      excerptSource: 'search_snippet',
    },
  },
};

const deferred: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Doe v. Roe (2019)',
  summary: 'The court deferred ruling on the Daubert motion.',
  url: 'https://www.courtlistener.com/opinion/2/doe-v-roe/',
  identityMatch: 'matched',
  raw: {
    documentType: 'expert_witness_case',
    caseName: 'Doe v. Roe',
    retrievalStatus: 'full_text',
    findingsRegardingExpert:
      'Not determined from the collected text. Read the opinion.',
    challenge: {
      standard: 'daubert',
      outcome: 'not_determined',
      role: 'unclear',
      quote: null,
      basis: 'not_determined',
      excerpts: [
        'The court deferred ruling on the Daubert motion to exclude Dr. Jane Smith.',
      ],
      excerptSource: 'opinion_text',
    },
  },
};

const docketDepositionMention: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Notice of Filing — Smith v. Jones',
  summary: 'Search excerpt: “The deposition of Jane Smith is scheduled.”',
  url: 'https://www.courtlistener.com/docket/3/notice/',
  identityMatch: 'matched',
  raw: {
    documentType: 'case',
    documentClass: 'other',
    caseName: 'Smith v. Jones',
    retrievalStatus: 'snippet_only',
  },
};

const ordinaryOpinion: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Poe v. Hospital (2018)',
  summary: 'Opinion that names the expert as an appointed examiner.',
  url: 'https://www.courtlistener.com/opinion/4/poe-v-hospital/',
  identityMatch: 'matched',
  raw: {
    documentType: 'case',
    caseName: 'Poe v. Hospital',
    docketCoverage: 'opinion_only',
    retrievalStatus: 'metadata_only',
  },
};

const finalRuling: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'State v. Expert (2021)',
  summary: 'The court excluded the expert’s testimony.',
  url: 'https://www.courtlistener.com/opinion/5/state-v-expert/',
  identityMatch: 'matched',
  raw: {
    documentType: 'expert_witness_case',
    caseName: 'State v. Expert',
    court: 'District Court, N.D. Florida',
    documentDate: '2021-03-01',
    retrievalStatus: 'full_text',
    challenge: {
      standard: 'daubert',
      outcome: 'excluded',
      role: 'challenged_expert',
      quote: 'the motion to exclude Dr. Demery is GRANTED',
      basis: 'court_text',
      excerpts: ['the motion to exclude Dr. Demery is GRANTED'],
      excerptSource: 'opinion_text',
    },
  },
};

const opinionDiscussing: ExpertEvidenceItem = {
  sourceId: 'courtlistener',
  category: 'legal',
  title: 'Green v. Clinic (2017)',
  summary: 'The opinion discusses Dr. Jason A. Demery’s methodology.',
  url: 'https://www.courtlistener.com/opinion/6/green-v-clinic/',
  identityMatch: 'matched',
  raw: {
    documentType: 'expert_witness_case',
    caseName: 'Green v. Clinic',
    retrievalStatus: 'full_text',
    challenge: {
      standard: 'daubert',
      outcome: 'not_determined',
      role: 'unclear',
      quote: null,
      basis: 'not_determined',
      excerpts: [
        'The court discussed the methodology of Dr. Jason A. Demery but did not rule on admissibility in the collected text.',
      ],
      excerptSource: 'opinion_text',
    },
  },
};

function fixtureClaim(
  id: string,
  category: CvClaim['category'],
  statement: string,
  details: CvClaim['details'],
): CvClaim {
  return { id, category, statement, details, page: 1, quote: statement };
}

const outDir = join(tmpdir(), 'ewi-3107-validation');

describe('EWI 3.10.7 fixture validation', () => {
  const service = new EwiPdfReportService(new PdfReportRenderer());

  beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  it('groups source-links and does not treat a URL as proof of a read page', async () => {
    const links = uniqueSourceLinks({
      evidence: [
        pubmed,
        {
          ...pubmed,
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
          title: 'Duplicate PubMed listing',
        },
        uncertainCourt,
      ],
      webResearch: dossier([
        strongSite,
        possibleDir,
        otherPerson,
        weakPage,
        strongSite,
      ]),
    });
    const subject = links.filter((link) => link.attribution === 'subject');
    const possible = links.filter((link) => link.attribution === 'possible');
    const other = links.filter((link) => link.attribution === 'other');
    expect(subject.map((link) => link.url)).toEqual(
      expect.arrayContaining([
        'https://pubmed.ncbi.nlm.nih.gov/11111111',
        'https://neuropsychologicalsciences.com/about',
      ]),
    );
    expect(subject.some((link) => link.url.includes('leila-glass'))).toBe(
      false,
    );
    expect(subject.some((link) => link.url.includes('expertinstitute'))).toBe(
      false,
    );
    expect(
      possible.find((link) => link.url.includes('expertinstitute'))?.access,
    ).toBe('search result only');
    expect(
      possible.find((link) => link.url.includes('unrelated'))?.attribution,
    ).toBe('possible');
    expect(
      possible.find((link) => link.url.includes('unrelated'))?.access,
    ).toBe('search result only');
    expect(
      other.find((link) => link.url.includes('leila-glass'))?.category,
    ).toMatch(/not this person/i);
    expect(
      other.find((link) => link.url.includes('demery-mentioned'))?.attribution,
    ).toBe('other');
    expect(new Set(links.map((link) => link.url)).size).toBe(links.length);

    const artifact = await service.buildSourceLinks({
      expertName: 'Jason A. Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
      evidence: [pubmed, uncertainCourt],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
      webResearch: dossier([strongSite, possibleDir, otherPerson, weakPage]),
    });
    writeFileSync(join(outDir, artifact.fileName), artifact.buffer);
    const text = await pdfText(artifact.buffer);
    expect(artifact.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(text).toMatch(/not proof that the page was read/i);
    expect(text).toMatch(/Sources tied to this expert/i);
    expect(text).toMatch(/Possible matches/i);
    expect(text).toMatch(/Other people or unconfirmed pages/i);
    expect(text).toMatch(/search result only/i);
    expect(text).toMatch(/page content read/i);
    expect(text).toMatch(/neuropsychologicalsciences\.com\/about/);
    expect(text).toMatch(/leila-glass/);
    expect(
      (text.match(/pubmed\.ncbi\.nlm\.nih\.gov\/11111111/g) ?? []).length,
    ).toBe(1);
  }, 20000);

  it('keeps motions, deferred Daubert, docket snippets, and catalog rows honest in the report sections', async () => {
    const legalResearch = buildLegalResearchDossier({
      evidence: [
        motion,
        deferred,
        docketDepositionMention,
        ordinaryOpinion,
        finalRuling,
        opinionDiscussing,
      ],
    });
    const prepared = prepareEwiReportInput({
      expertName: 'Jason A. Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
      evidence: [
        pubmed,
        motion,
        deferred,
        docketDepositionMention,
        ordinaryOpinion,
        finalRuling,
        opinionDiscussing,
      ],
      discrepancies: [
        {
          id: 'd-miss',
          field: 'publication',
          title: 'Publication not found in the catalogs checked: Missing paper',
          description: 'Catalog miss',
          severity: 'low',
          evidenceIds: [],
          relatedUrls: [],
          label: 'not_found',
          previousValue: 'Missing paper',
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: 'Uploaded CV: fixture-cv.pdf',
          supportingSource: 'OpenAlex',
          priority: 3,
          sources: [],
        },
      ],
      questions: [],
      questionCount: 0,
      sourceStatuses: [],
      reportFileName: 'ewi-jason-a-demery-report.pdf',
      generatedAt: '2026-10-26T12:00:00.000Z',
      disclaimer: '',
      summary: '',
      analysis: undefined as never,
      legalResearch,
      onlinePresence: undefined as never,
      professionalBackground: undefined as never,
      cvCheck: null,
    });
    expect(prepared.cvComparisonState).toBe('not_uploaded');
    expect(
      prepared.discrepancies.some((row) =>
        /not found in the catalogs/i.test(row.title),
      ),
    ).toBe(false);

    const document = buildEwiReportDocument(prepared);
    const pleadings = sectionText(document, 'pleadings');
    const orders = sectionText(document, 'orders');
    const depositions = sectionText(document, 'depositions');
    const admissibility = sectionText(document, 'admissibility-challenges');
    const lawsuits = sectionText(document, 'lawsuits');
    const publications = sectionText(document, 'publications');
    const summary = sectionText(document, 'summary');
    const cv = sectionText(document, 'cv-comparison');

    expect(pleadings).toMatch(/MOTION to Exclude/i);
    expect(pleadings).toMatch(/how the court ruled/i);
    expect(pleadings).not.toMatch(/Excluded —/);
    expect(pleadings).not.toMatch(/the court found/i);
    expect(orders).not.toMatch(/MOTION to Exclude/i);
    expect(admissibility).toMatch(/1 filed motion\(s\)/);
    expect(admissibility).toMatch(/court opinion\(s\)\/order\(s\)/);
    expect(admissibility).toMatch(
      /1 ruling\(s\) from the court’s words: Excluded 1/,
    );
    expect(admissibility).not.toMatch(/2 opinion\(s\): Not determined 2/);
    expect(admissibility).toMatch(/Filed motion \(not a court opinion\)/);
    expect(admissibility).toMatch(
      /A challenge was filed\. Outcome was not established from the retrieved materials/,
    );
    expect(admissibility).toMatch(/Only a search-result snippet was reviewed/);
    expect(admissibility).toMatch(/deferred ruling/i);
    expect(admissibility).toMatch(/Not determined/);
    expect(admissibility).toMatch(
      /Collected opinion or order text was reviewed/,
    );
    expect(admissibility).toMatch(/Kind: Court ruling/);
    expect(admissibility).toMatch(
      /the motion to exclude Dr\. Demery is GRANTED/,
    );
    expect(admissibility).toMatch(/Green v\. Clinic/);
    expect(admissibility).toMatch(
      /Roberts v\. Example[\s\S]*Kind: Filed motion \(not a court opinion\)/,
    );
    expect(depositions).not.toMatch(/Notice of Filing/i);
    expect(depositions).not.toMatch(/deposition of Jane Smith is scheduled/i);
    const misc = sectionText(document, 'misc');
    expect(misc).toMatch(/Notice of Filing/);
    expect(misc).toMatch(/transcript was not retrieved/i);
    expect(misc).toMatch(/not deposition testimony/i);
    expect(sectionText(document, 'overall-findings')).not.toMatch(
      /Notice of Filing/,
    );
    expect(lawsuits).toMatch(/Related court records were collected/);
    expect(lawsuits).not.toMatch(/This was not searched/);
    expect(lawsuits).not.toMatch(/Poe v\. Hospital/);
    const sourceIndex = sectionText(document, 'source-index');
    expect(sourceIndex).toMatch(/search result only/);
    expect(sourceIndex).toMatch(/docket metadata only/);
    expect(sourceIndex).toMatch(/page content read/);
    expect(sourceIndex).not.toMatch(/access: retrieved(?:\.|;|$)/);
    expect(publications).toMatch(/Catalog record found/i);
    expect(publications).toMatch(/not a CV comparison/i);
    expect(cv).toMatch(/No CV was uploaded/);
    expect(cv).toMatch(/CV comparison was not performed/);
    expect(summary).toMatch(/CV comparison was not performed/);
    expect(summary).not.toMatch(/Unchecked CV claims/);
    expect(summary).not.toMatch(/unique CV claim\(s\) were read/);

    const pdf = await service.build(prepared);
    writeFileSync(join(outDir, 'ewi-jason-a-demery-no-cv.pdf'), pdf.buffer);
    const rendered = await pdfText(pdf.buffer);
    expect(pdf.templateVersion).toBe('3.10.13');
    expect(rendered).toMatch(/3\.10\.13/);
    expect(rendered).toMatch(/No CV was uploaded/);
    expect(rendered).toMatch(/Catalog record found/);
    expect(rendered).not.toMatch(/No CV versions were collected/);
  }, 20000);

  it('extracts later practice-site facts without taking another person’s credentials', () => {
    const subject = subjectFromQuery({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    if (!subject) throw new Error('subject');
    const facts = extractFacts({
      url: 'https://neuropsychologicalsciences.com/about',
      kind: 'other',
      title: 'About',
      text: 'Dr. Jason A. Demery, Ph.D., ABPP is a clinical neuropsychologist in Gainesville, Florida. Dr. Demery earned his Ph.D. in Clinical Psychology from the University of Florida. He provides forensic neuropsychological evaluations and independent medical examinations for attorneys. Leila Glass, PhD, earned her doctorate from UCLA.',
      subject,
      ownPage: false,
    });
    expect(facts.some((fact) => fact.topic === 'education')).toBe(true);
    expect(facts.find((fact) => fact.topic === 'education')?.quote).toMatch(
      /University of Florida/,
    );
    expect(facts.some((fact) => /UCLA/.test(fact.quote ?? ''))).toBe(false);
    expect(facts.some((fact) => fact.topic === 'ime')).toBe(true);

    const possibleMembership = webRecord({
      id: 'aacn-other',
      url: 'https://www.theaacn.org/member-directory/other',
      title: 'Possible AACN listing',
      kind: 'directory',
      read: 'read',
      match: {
        level: 'possible',
        confidence: 'medium',
        basis: ['surname', 'specialty'],
        conflicts: [],
        quote: 'Jason Demery',
        quoteVerified: false,
        classifiedBy: 'rules',
      },
      claims: [
        {
          type: 'credential',
          text: 'Membership: AACN member directory',
          quote: 'Jason Demery, AACN member',
          topic: 'membership',
          basis: 'third_party',
          from: 'page',
        },
      ],
    });
    const routed = routeWebFindings(dossier([possibleMembership]));
    expect(routed.get('directories')).toBeUndefined();
    expect(routed.get('memberships')?.[0].matchLevel).toBe('possible');
    const report = buildEwiReportDocument({
      expertName: 'Jason A. Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
      webResearch: dossier([possibleMembership]),
    });
    expect(sectionText(report, 'memberships')).toMatch(
      /Possible matches \(not confirmed memberships or affiliations\)/,
    );
    expect(sectionText(report, 'memberships')).toMatch(/possible match/i);
    expect(sectionText(report, 'memberships')).not.toMatch(/Status: Verified/);
    expect(sectionText(report, 'summary')).toMatch(/Possible match/);
    expect(sectionText(report, 'summary')).not.toMatch(/Status: Verified/);
    expect(sectionText(report, 'overall-findings')).toMatch(/Possible match/);
    expect(sectionText(report, 'overall-findings')).not.toMatch(
      /Memberships: (?!Possible match)/,
    );
  });

  it('reconciles fixture CV counts without treating catalog rows as the CV', async () => {
    const extraction = {
      document: {
        id: 'fixture-cv',
        name: 'fixture-cv.pdf',
        pageCount: 1,
        unreadablePages: [],
        ocrPages: [],
      },
      status: 'completed' as const,
      warnings: ['Fixture extraction. Not a real uploaded CV.'],
      claims: [
        fixtureClaim(
          'cv-p',
          'publication',
          'Cognitive outcomes after mild TBI',
          {
            title: 'Cognitive outcomes after mild TBI',
            year: '2017',
          },
        ),
        fixtureClaim('cv-m', 'membership', 'AACN member', { name: 'AACN' }),
      ],
    };
    const cvCheck = compareCv({
      extraction,
      evidence: [pubmed],
      sourceResults: [],
      identity: {
        status: 'confirmed',
        identity: {
          npi: '1700077724',
          name: 'Jason A. Demery',
          credential: 'PhD',
          taxonomy: 'Clinical Neuropsychologist',
          city: 'GAINESVILLE',
          state: 'FL',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
        },
        basis: ['npi'],
        note: 'Confirmed.',
        notes: [],
        candidates: [],
      },
      publications: [],
      expertName: 'Jason A. Demery',
    });
    const document = buildEwiReportDocument({
      expertName: 'Jason A. Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
      evidence: [pubmed],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
      cvCheck,
      cvComparisonState: 'compared',
    });
    const summary = sectionText(document, 'summary');
    const cv = sectionText(document, 'cv-comparison');
    expect(summary).toMatch(/2 unique CV claim\(s\) were read/);
    expect(cv).toMatch(/2 unique CV claim\(s\) were read/);
    expect(summary).toMatch(
      /Unique CV claims \(2\) = compared \(2\) \+ uncompared \(0\)/,
    );
    expect(cv).toMatch(/Fixture extraction/);
    const pdf = await service.build({
      expertName: 'Jason A. Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
      evidence: [pubmed],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
      cvCheck,
      cvComparisonState: 'compared',
    });
    writeFileSync(
      join(outDir, 'ewi-jason-a-demery-fixture-cv.pdf'),
      pdf.buffer,
    );
    const rendered = await pdfText(pdf.buffer);
    expect(rendered).toMatch(/2 unique CV claim\(s\) were read/);
    expect(rendered).toMatch(/Fixture extraction/);
  }, 20000);
});
