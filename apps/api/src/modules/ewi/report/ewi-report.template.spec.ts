import { buildGroundedCrossExamQuestions } from './ewi-report-questions';
import {
  EWI_REPORT_SECTIONS,
  buildEwiReportDocument,
} from './ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from './ewi-report.version';
import { EwiPdfReportService } from './ewi-pdf-report.service';
import { PdfReportRenderer } from '@platform/report/pdf/pdf-report.renderer';
import { DocxReportRenderer } from '@platform/report/docx/docx-report.renderer';
import mammoth from 'mammoth';
import { EwiWordReportService } from './ewi-word-report.service';
import { PdfParser } from '@modules/document-processing/parsers/pdf.parser';
import { buildDeterministicAnalysis } from '../investigation/analysis/deterministic-analysis';
import type { MatchLevel, WebRecord } from '@integrations/web-research';

/** The PDF's text, page by page, as the app's own PDF reader extracts it. */
async function pdfPages(buffer: Buffer): Promise<string[]> {
  const parsed = await new PdfParser().parse({
    filePath: 'report.pdf',
    buffer,
    filename: 'report.pdf',
    extension: 'pdf',
    fileSize: buffer.byteLength,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });
  return parsed.pages.map((page) => page.text);
}

describe('EWI report template', () => {
  const renderer = new PdfReportRenderer();

  it('includes the full 42-section outline with metadata, TOC, version, and disclaimer', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    expect(document.sections).toHaveLength(42);
    expect(document.sections.map((section) => section.title)).toEqual(
      EWI_REPORT_SECTIONS.map((section) => section.title),
    );
    expect(EWI_REPORT_TEMPLATE_VERSION).toBe('3.10.3');
    expect(document.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(document.includeTableOfContents).toBe(true);
    expect(document.metadata?.expertName).toBe('Jane Doe');
    expect(document.metadata?.city).toBe('Boston');
    expect(document.metadata?.specialty).toBe('Neurology');
    expect(document.metadata?.investigationDate).toBe('2026-09-23');
    expect(document.metadata?.disclaimer).toMatch(
      /independently reviewed|attorney review/i,
    );
    expect(
      document.sections.find((s) => s.id === 'expert-name')?.blocks[0]?.text,
    ).toBe('Jane Doe');
    expect(document.format).toBe('pdf');
    expect(document.mimeType).toBe('application/pdf');
    expect(document.fileName).toBe('ewi-jane-doe-report.pdf');
    expect(document.highlights).toEqual([
      '0 collected items',
      '0 inconsistencies',
      '0 cross-examination questions',
    ]);
    // Sections 1–5 are on the cover; every other section is a card with an icon.
    expect(
      document.sections.slice(0, 5).map((section) => section.placement),
    ).toEqual([
      'cover-fact',
      'cover-fact',
      'cover-fact',
      'cover-fact',
      'cover-summary',
    ]);
    for (const section of document.sections.slice(5)) {
      expect(section.placement).toBeUndefined();
      expect(section.icon).toBeDefined();
    }
    // The cover shows the subject and the counts, and the disclaimer has
    // its own card, so the summary does not repeat them.
    const summaryText = document.sections
      .find((section) => section.id === 'summary')
      ?.blocks.map((block) => block.text)
      .join('\n');
    expect(summaryText).not.toMatch(/Subject:|cross-examination question/);
    expect(summaryText).not.toContain(document.metadata?.disclaimer);
    expect(
      document.sections
        .find((section) => section.id === 'board-certifications')
        ?.blocks.map((block) => block.text)
        .join(' '),
    ).toBe('This was not searched in this investigation.');
    expect(
      document.sections.find((section) => section.id === 'questions')?.blocks[0]
        ?.text,
    ).toMatch(/facts were not invented/i);
  });

  it('does not list a "could not verify" line for each source that returned nothing', () => {
    const analysis = buildDeterministicAnalysis({
      expertName: 'Jane Doe',
      specialty: 'Neurology',
      findings: [],
      sourceAttempts: ['npi_registry', 'courtlistener', 'lexisnexis'].map(
        (providerId) => ({
          sourceRef: `source:${providerId}`,
          providerId,
          category: providerId,
          status: providerId === 'lexisnexis' ? 'unavailable' : 'ok',
          access: providerId === 'lexisnexis' ? 'restricted' : 'public',
          itemCount: 0,
        }),
      ),
    });
    expect(analysis.missing).toHaveLength(3);
    // A summary saved before the per-source lines were dropped.
    const savedSummary = [
      analysis.summary,
      ...analysis.missing.map((item) => item.note),
    ].join('\n');

    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
      summary: savedSummary,
      analysis,
    });
    const sectionText = (id: string) =>
      document.sections
        .find((section) => section.id === id)
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';

    expect(sectionText('summary')).toContain(
      'No information about this expert was confirmed from the sources retrieved.',
    );
    for (const id of ['summary', 'overall-findings']) {
      expect(sectionText(id)).not.toMatch(
        /Could not verify|Nothing was inferred|Gap \[/,
      );
    }
  });

  it('does not print "not verified" on findings, records, sources, or questions', () => {
    const findings = [
      {
        findingKey: 'f1',
        category: 'license',
        title: 'Licenses reported to the NPI Registry (NPI 1871685487)',
        summary: 'Licensed in Ohio.',
        url: 'https://npiregistry.cms.hhs.gov/provider-view/1871685487',
        providerId: 'npi_registry',
        informationStatus: 'unverified',
        access: 'public',
      },
      {
        findingKey: 'f2',
        category: 'income_bias',
        title: 'CMS Open Payments 2019–2025: $149,124.74 from 10 companies',
        summary: 'Payments from drug and device makers.',
        providerId: 'open_payments',
        informationStatus: 'verified',
        access: 'public',
      },
    ];
    const analysis = buildDeterministicAnalysis({
      expertName: 'Jane Doe',
      specialty: 'Neurology',
      findings,
      sourceAttempts: [],
    });
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: findings.map((finding) => ({
        sourceId: finding.providerId,
        category: finding.category,
        title: finding.title,
        summary: finding.summary,
        url: finding.url,
        access: 'public',
        informationStatus: finding.informationStatus,
      })) as Parameters<typeof buildEwiReportDocument>[0]['evidence'],
      discrepancies: [],
      questions: [
        {
          number: 1,
          category: 'license',
          question: 'Is every license in finding f1 current?',
          evidenceBasis:
            'f1 — Evidence for this item is weak, conflicting, restricted, or not verified; treat confirmation as open.',
        },
      ],
      generatedAt: '2026-10-19T00:00:00.000Z',
      summary: [
        analysis.summary,
        'Could not verify "Licenses reported to the NPI Registry (NPI 1871685487)". The npi_registry statement is not verified.',
      ].join('\n'),
      analysis,
    });
    const text = (id: string) =>
      document.sections
        .find((section) => section.id === id)
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    const all = document.sections
      .flatMap((section) => section.blocks.map((block) => block.text))
      .join('\n');

    expect(all).not.toMatch(/not verified|unverified|could not verify/i);
    expect(text('overall-findings')).toContain(
      'Licenses reported to the NPI Registry (NPI 1871685487)',
    );
    expect(text('overall-findings')).toContain('Verified · Source refs: f2');
    expect(text('questions')).toContain('Basis: f1');
    expect(text('summary')).toContain(
      '2 item(s) were collected from the sources searched.',
    );
  });

  it('keeps restricted source text out of the report and does not claim a PDF was saved', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'lexisnexis',
          category: 'legal',
          title: 'Licensed opinion index',
          summary: 'This licensed paragraph must not appear.',
          url: 'https://www.lexisnexis.com/example',
          access: 'restricted',
          informationStatus: 'unverified',
          raw: {
            documentType: 'order',
            caseName: 'Doe v. Roe',
            caseNumber: '1:20-cv-1',
            documentDate: '2020-05-01',
            findingsRegardingExpert: 'Testimony limited',
            evidenceReference: 'order-1',
            orderTags: ['limits_expert'],
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const orders = document.sections.find((section) => section.id === 'orders');
    const text = orders?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text).toContain('Licensed opinion index');
    expect(text).not.toContain('licensed paragraph');
    expect(text).toMatch(/authorized access|not stored/i);
    expect(text.toLowerCase()).toMatch(
      /pdfs? (are )?not stored|no pdf was saved/i,
    );
    expect(text.toLowerCase()).not.toMatch(/pdf was saved for|saved the pdf/i);
    expect(
      orders?.blocks.some(
        (block) => block.link === 'https://www.lexisnexis.com/example',
      ),
    ).toBe(true);
  });

  it('lists orders with case, number, date, finding, and source link', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'court_order',
          title: 'Order limiting testimony',
          summary: 'Court limited the expert on methodology.',
          url: 'https://www.courtlistener.com/opinion/1/',
          access: 'public',
          informationStatus: 'verified',
          raw: {
            documentType: 'order',
            caseName: 'Smith v. Jones',
            caseNumber: '2:21-cv-99',
            documentDate: '2021-06-15',
            findingsRegardingExpert: 'Testimony limited on causation',
            evidenceReference: 'CL-order-1',
            orderTags: ['limits_expert', 'qualifications'],
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const orders = document.sections.find((section) => section.id === 'orders');
    const text = orders?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text).toMatch(/Smith v\. Jones/);
    expect(text).toMatch(/2:21-cv-99/);
    expect(text).toMatch(/2021-06-15/);
    expect(text).toMatch(/Testimony limited on causation/);
    expect(text).toMatch(/CL-order-1/);
    expect(
      orders?.blocks.some(
        (block) => block.link === 'https://www.courtlistener.com/opinion/1/',
      ),
    ).toBe(true);
  });

  it('presents income chronologically without inventing percentages', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'open_payments',
          category: 'income_bias',
          title: 'Open Payments 2022',
          summary: 'Public payment record.',
          url: 'https://openpayments.example/1',
          access: 'public',
          informationStatus: 'verified',
          raw: {
            professionalKind: 'open_payments',
            paymentDate: '2022-03-01',
            paymentAmount: '$1,200',
            payer: 'Acme Device Co',
            percentForensicWork: '40%',
          },
        },
        {
          sourceId: 'open_payments',
          category: 'income_bias',
          title: 'Open Payments 2021',
          summary: 'Earlier public payment record.',
          url: 'https://openpayments.example/0',
          access: 'public',
          informationStatus: 'verified',
          raw: {
            professionalKind: 'open_payments',
            paymentDate: '2021-01-15',
            paymentAmount: '$800',
            payer: 'Acme Device Co',
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const income = document.sections.find(
      (section) => section.id === 'income-bias',
    );
    const text = income?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text.indexOf('2021')).toBeLessThan(text.indexOf('2022'));
    expect(text).toMatch(/40%/);
    expect(text).toMatch(/as stated/i);
    expect(text).not.toMatch(/estimated 60%/i);
    expect(text).not.toMatch(/percentage was estimated|we infer/i);
  });

  it('lists publications with authorship fields when present and does not invent page numbers', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Spine outcomes study',
          summary: 'Collected publication record.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
          access: 'public',
          informationStatus: 'unverified',
          raw: {
            authors: 'Doe J, Roe A',
            publicationDate: '2019',
            journal: 'Spine Journal',
            firstAuthor: 'yes',
            retractionStatus: 'none stated',
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const pubs = document.sections.find(
      (section) => section.id === 'publications',
    );
    const text = pubs?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text).toMatch(/Authors: Doe J, Roe A/);
    expect(text).toMatch(/Date: 2019/);
    expect(text).toMatch(/Journal: Spine Journal/);
    expect(text).toMatch(/Author order: first of 2 authors/);
    expect(text).toMatch(/list position, not a publisher designation/i);
    expect(text).not.toMatch(/First\/lead author status/i);
    expect(text).toMatch(/Retraction status: none stated/);
    expect(text).not.toMatch(/page 47|p\.\s*12/i);
  });

  it('prints a first-author CV comparison table with source URLs', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
      cvCheck: {
        document: {
          id: 'cv1',
          name: 'Doe-CV.pdf',
          pageCount: 4,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [],
        warnings: [],
        comparisons: [
          {
            id: 'p1',
            topic: 'publication',
            label: 'verified',
            severity: 'low',
            title:
              'Verified match. Publication found with the expert as an author (first of 3 authors): Memory after TBI',
            cv: {
              statement: 'Doe J, Roe A (2018). Memory after TBI.',
              page: 3,
            },
            source: {
              name: 'PubMed',
              statement: 'Memory after TBI (2018). Authors: Doe J, Roe A, Lee B.',
              url: 'https://pubmed.ncbi.nlm.nih.gov/99/',
            },
            note: 'PubMed lists the expert as first of 3 authors.',
          },
        ],
      },
    });
    const text =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(text).toMatch(/confirmed first author/i);
    expect(text).toContain('https://pubmed.ncbi.nlm.nih.gov/99/');
    expect(text).toContain('CV citation:');
    expect(text).toContain('Verified citation:');
  });

  it('does not label an unverified catalog hit as a verified citation', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
      cvCheck: {
        document: {
          id: 'cv1',
          name: 'Doe-CV.pdf',
          pageCount: 4,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [],
        warnings: [],
        comparisons: [
          {
            id: 'p-partial',
            topic: 'publication',
            label: 'unable_to_verify',
            severity: 'medium',
            title:
              'Partial match; manual review required. Publication found; the expert\'s authorship could not be confirmed from the catalogs: Verbal learning following mild traumatic brain injury',
            cv: {
              statement:
                'Demery, J.A. (1999). Verbal learning following mild traumatic brain injury [Abstract].',
              page: 1,
            },
            source: {
              name: 'OpenAlex',
              statement:
                'Verbal Learning Strategy Following Mild Traumatic Brain Injury (2011). Authors: Elizabeth Geary.',
              url: 'https://doi.org/10.1017/s1355617711000646',
            },
            note: 'This is not a finding that the expert did not write it.',
          },
        ],
      },
    });
    const text =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(text).toContain('Catalog record:');
    expect(text).not.toMatch(/Verified citation:/);
    expect(text).toMatch(/unable to verify/i);
  });

  it('does not call a truncated catalog list confirmed first authorship', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
      cvCheck: {
        document: {
          id: 'cv1',
          name: 'Doe-CV.pdf',
          pageCount: 4,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [],
        warnings: [],
        comparisons: [
          {
            id: 'p2',
            topic: 'publication',
            label: 'verified',
            severity: 'low',
            title:
              'Verified match (author position not verifiable). Publication found with the expert as an author (first of 3 authors): Memory after TBI',
            cv: {
              statement: 'Doe J, Roe A (2018). Memory after TBI.',
              page: 3,
            },
            source: {
              name: 'PubMed',
              statement: 'Memory after TBI (2018). Authors: Doe J, Roe A.',
              url: 'https://pubmed.ncbi.nlm.nih.gov/99/',
            },
            note: 'Author position not verifiable: the catalog author list is truncated or shorter than the CV citation.',
          },
        ],
      },
    });
    const text =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(text).toMatch(/unable to verify/i);
    expect(text).not.toMatch(/confirmed first author/i);
  });

  it('keeps the YouTube URL and explains when a transcript is unavailable', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'youtube',
          category: 'video',
          title: 'Grand rounds',
          summary: 'Public YouTube video.',
          url: 'https://www.youtube.com/watch?v=abc123XYZ00',
          access: 'public',
          informationStatus: 'unverified',
          raw: {
            presenceKind: 'youtube',
            platform: 'youtube',
            transcriptAvailable: false,
            transcriptUnavailableReason:
              'This YouTube video cannot be transcribed automatically; open the link to watch it.',
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });
    const videos = document.sections.find((section) => section.id === 'videos');
    const text = videos?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text).toContain('https://www.youtube.com/watch?v=abc123XYZ00');
    expect(text).toMatch(/cannot be transcribed automatically/i);
    expect(
      videos?.blocks.some(
        (block) =>
          block.link === 'https://www.youtube.com/watch?v=abc123XYZ00',
      ),
    ).toBe(true);
  });

  it('prioritizes inconsistencies and compares membership claims when collected', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'memberships',
          category: 'membership',
          title: 'AAN membership listing',
          summary: 'Public membership page.',
          url: 'https://membership.example/aan',
          access: 'public',
          informationStatus: 'verified',
          raw: {
            professionalKind: 'membership',
            organization: 'AAN',
            cvClaim: 'Member since 2010',
            publicRecord: 'Active member listing',
          },
        },
      ],
      discrepancies: [
        {
          id: 'd1',
          severity: 'high',
          title: 'Graduation year conflict',
          description: 'CV states 2001; directory states 2003.',
          evidenceIds: ['CV', 'Directory'],
          relatedUrls: ['https://cv.example', 'https://dir.example'],
          label: 'conflicting',
          field: 'graduation_date',
          previousValue: '2001',
          currentValue: '2003',
          change: 'year changed',
          cvDate: '2020-01-01',
          cvSource: 'CV PDF metadata title only',
          supportingSource: 'Directory',
          priority: 1,
          sources: [
            {
              sourceId: 'cv',
              sourceName: 'CV',
              title: 'CV',
              url: 'https://cv.example',
              value: '2001',
            },
          ],
        },
      ],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const inconsistencies = document.sections.find(
      (section) => section.id === 'inconsistencies',
    );
    expect(inconsistencies?.blocks[0]?.text).toMatch(/primary focus/i);
    expect(
      inconsistencies?.blocks.map((block) => block.text).join('\n'),
    ).toMatch(/Graduation year conflict/);

    const memberships = document.sections.find(
      (section) => section.id === 'memberships',
    );
    const membershipText =
      memberships?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(membershipText).toMatch(/CV claim: Member since 2010/);
    expect(membershipText).toMatch(
      /public\/verified record: Active member listing/i,
    );
  });

  it('writes a PDF with a cover, contents, and many boxed questions', async () => {
    const evidence = Array.from({ length: 60 }, (_, index) => ({
      sourceId: 'pubmed' as const,
      category: 'publication',
      title: `Development fixture: spine study ${index + 1}`,
      summary: `Development fixture article number ${index + 1} about lumbar fusion outcomes in adults.`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${index + 1}/`,
      access: 'public' as const,
      informationStatus: 'unverified' as const,
    }));
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence,
    });
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence,
      discrepancies: [],
      questions,
      generatedAt: '2026-09-23T00:00:00.000Z',
      summary: 'The collected publication record is listed under Publications.',
    });
    const rendered = await renderer.render(document);
    const pages = await pdfPages(rendered.buffer);
    const all = pages.join('\n');

    expect(questions.length).toBe(60);
    expect(document.highlights).toEqual([
      '60 collected items',
      '0 inconsistencies',
      '60 cross-examination questions',
    ]);
    expect(
      document.sections
        .find((section) => section.id === 'questions')
        ?.blocks.filter((block) => block.style === 'item'),
    ).toHaveLength(60);
    expect(rendered.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(rendered.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(rendered.mimeType).toBe('application/pdf');
    expect(rendered.fileName).toBe('ewi-jane-doe-report.pdf');
    expect(pages.length).toBeGreaterThan(5);
    expect(pages[0]).toContain('EXPERT WITNESS INVESTIGATION REPORT');
    expect(pages[0]).toContain('Jane Doe');
    expect(pages[0]).toContain('1. EXPERT NAME');
    expect(pages[0]).toContain(
      'The collected publication record is listed under Publications.',
    );
    expect(all).toContain('Contents');
    expect(all).toContain('42. Cross-Examination Questions');
    expect(all).toContain(questions[0].question.slice(0, 40));
    expect(all).toContain(
      questions[questions.length - 1].question.slice(0, 30),
    );
    expect(all).toContain('(continued)');
    expect(all).toContain('Disclaimer');
    pages.forEach((page, index) =>
      expect(page).toContain(`Page ${index + 1} of ${pages.length}`),
    );
  }, 20000);
});

describe('EwiPdfReportService', () => {
  it('builds the PDF report through the shared renderer', async () => {
    const service = new EwiPdfReportService(new PdfReportRenderer());
    const evidence = [
      {
        sourceId: 'social' as const,
        category: 'social',
        title: 'Public LinkedIn listing',
        summary: 'Public profile headline only.',
        url: 'https://linkedin.example/jane',
        access: 'public' as const,
        informationStatus: 'unverified' as const,
        raw: {
          presenceKind: 'social',
          platform: 'linkedin',
        },
      },
    ];
    const artifact = await service.build({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence,
      discrepancies: [],
      questions: buildGroundedCrossExamQuestions({
        expertName: 'Jane Doe',
        evidence,
      }),
      generatedAt: '2026-09-29T12:00:00.000Z',
      summary: 'A public social listing was collected.',
    });

    expect(artifact.format).toBe('pdf');
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.templateId).toBe('ewi/investigation-report');
    expect(artifact.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(artifact.fileName).toBe('ewi-jane-doe-report.pdf');
    expect(artifact.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const text = (await pdfPages(artifact.buffer)).join('\n');
    expect(text).toContain('Public LinkedIn listing');
    expect(text).toContain('https://linkedin.example/jane');
  });
});

describe('EwiWordReportService', () => {
  it('builds the same report as a Word file', async () => {
    const service = new EwiWordReportService(new DocxReportRenderer());
    const evidence = [
      {
        sourceId: 'social' as const,
        category: 'social',
        title: 'Public LinkedIn listing',
        summary: 'Public profile headline only.',
        url: 'https://linkedin.example/jane',
        access: 'public' as const,
        informationStatus: 'unverified' as const,
        raw: { presenceKind: 'social', platform: 'linkedin' },
      },
    ];
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence,
    });
    const artifact = await service.build({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence,
      discrepancies: [],
      questions,
      generatedAt: '2026-09-29T12:00:00.000Z',
      summary: 'A public social listing was collected.',
    });
    const { value: text } = await mammoth.extractRawText({
      buffer: artifact.buffer,
    });
    const { value: html } = await mammoth.convertToHtml({
      buffer: artifact.buffer,
    });

    expect(artifact.format).toBe('docx');
    expect(artifact.fileName).toBe('ewi-jane-doe-report.docx');
    expect(artifact.mimeType).toContain('wordprocessingml');
    expect(artifact.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(artifact.buffer.subarray(0, 2).toString()).toBe('PK');
    for (const expected of [
      'EXPERT WITNESS INVESTIGATION REPORT',
      'Jane Doe',
      'Neurology · Boston',
      '5. Executive Summary',
      'A public social listing was collected.',
      '6. Expert Background',
      '31. Social Media',
      'Public LinkedIn listing',
      '42. Cross-Examination Questions',
      questions.length > 0
        ? `1. [Unresolved] ${questions[0].question}`
        : 'Cross-examination questions were not generated',
      'Disclaimer',
    ]) {
      expect(text).toContain(expected);
    }
    expect(html).toContain('<a href="https://linkedin.example/jane">');
  });

  it('prints the same grounded question count in Word as in the report input', async () => {
    const service = new EwiWordReportService(new DocxReportRenderer());
    const evidence = [
      {
        sourceId: 'state_license' as const,
        category: 'license',
        title: 'CA License',
        summary:
          'California psychologist license PSY12345 is active and was issued in 2009.',
        url: 'https://example.test/license',
        access: 'public' as const,
        informationStatus: 'verified' as const,
        identityMatch: 'matched' as const,
        source: {
          providerId: 'state_license' as const,
          name: 'California DCA',
          retrievedAt: '2026-10-01T00:00:00.000Z',
          access: 'public' as const,
        },
      },
    ];
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence,
    });
    const artifact = await service.build({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence,
      discrepancies: [],
      questions,
      generatedAt: '2026-10-21T12:00:00.000Z',
    });
    const { value: text } = await mammoth.extractRawText({
      buffer: artifact.buffer,
    });
    expect(questions).toHaveLength(1);
    expect(text).toContain('1 cross-examination question');
    expect(text).toContain(questions[0].question);
    expect(text).toContain('https://example.test/license');
    expect(text).not.toMatch(/finding f1|collected record/i);
  });

  it('keeps CV comparison and publications in agreement for a PubMed-backed citation', () => {
    const document = buildEwiReportDocument({
      expertName: 'Leah Ellenberg',
      city: 'Los Angeles',
      specialty: 'Neuropsychology',
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI.',
          summary:
            'PubMed lists “Memory after pediatric TBI.” Authors: Ellenberg L, Smith J. Listed as first author.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            pmid: '11111111',
            authors: ['Ellenberg L', 'Smith J'],
            authorPosition: 'first',
            authorIndex: 0,
            authorCount: 2,
            pubdate: '1999 Jan',
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T00:00:00.000Z',
      identity: {
        status: 'ambiguous',
        identity: null,
        basis: [],
        note: 'No NPI Registry record matches the name and specialty in Los Angeles. 1 record(s) match the name and specialty in another city (NPI 1234567893 in BEVERLY HILLS, CA). The city entered for this investigation is not the registry practice city, so the record was not used as a confirmed identity.',
        notes: [],
        candidates: [
          {
            npi: '1234567893',
            name: 'Leah Ellenberg, PhD',
            credential: 'PhD',
            taxonomy: 'Clinical Neuropsychologist',
            city: 'BEVERLY HILLS',
            state: 'CA',
            url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
          },
        ],
      },
      cvCheck: {
        document: {
          id: 'cv1',
          name: 'ellenberg-cv.pdf',
          pageCount: 6,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [
          {
            id: 'cv-p',
            category: 'publication',
            statement: 'Ellenberg L (1999). Memory after pediatric TBI.',
            details: { title: 'Memory after pediatric TBI' },
            page: 2,
            quote: 'Memory after pediatric TBI',
          },
          {
            id: 'cv-m',
            category: 'membership',
            statement: 'AACN member',
            details: { name: 'AACN' },
            page: 1,
            quote: 'AACN member',
          },
        ],
        warnings: [],
        comparisons: [
          {
            id: 'cvc-1',
            topic: 'publication',
            label: 'verified',
            severity: 'low',
            title:
              'Verified match. Publication found with the expert as an author (first of 2 authors): Memory after pediatric TBI',
            cv: {
              claimId: 'cv-p',
              statement: 'Ellenberg L (1999). Memory after pediatric TBI.',
              page: 2,
            },
            source: {
              name: 'PubMed',
              statement:
                'Memory after pediatric TBI (1999). Authors: Ellenberg L, Smith J. PMID 11111111',
              url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
            },
            note: 'PubMed lists the expert as first of 2 authors.',
          },
          {
            id: 'cvc-2',
            topic: 'membership',
            label: 'unable_to_verify',
            severity: 'low',
            title: 'Membership: AACN member',
            cv: { claimId: 'cv-m', statement: 'AACN member', page: 1 },
            source: null,
            note: 'No membership directory is connected for this claim.',
          },
        ],
      },
    });
    const cv =
      document.sections
        .find((section) => section.id === 'cv-comparison')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    const publications =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    const summary =
      document.sections
        .find((section) => section.id === 'summary')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    const background =
      document.sections
        .find((section) => section.id === 'background')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(cv).toMatch(/2 claim\(s\) were read/);
    expect(cv).toMatch(/2 of those claims appear/);
    expect(cv).toMatch(/Verified: 1; Not checked: 1/);
    expect(cv).toMatch(/\[Verified\]/);
    expect(cv).not.toMatch(/Not confirmed in the catalogs searched: Memory after pediatric TBI/);
    expect(publications).toContain('Verified citation:');
    expect(publications).toContain('https://pubmed.ncbi.nlm.nih.gov/11111111/');
    expect(publications).toMatch(/first of 2 authors/i);
    expect(summary).toMatch(/Identity not confirmed/);
    expect(summary).toMatch(/2 claim\(s\) were read/);
    expect(summary).toMatch(/not counted as inconsistencies/);
    expect(background).toMatch(/registry city BEVERLY HILLS/);
    expect(background).not.toMatch(/Status: Verified/);
    expect(document.sections.find((section) => section.id === 'city')?.blocks[0]?.text).toBe(
      'Los Angeles',
    );
  });
});

describe('EWI report web research section', () => {
  const base = {
    expertName: 'Jason A. Demery',
    city: '',
    specialty: 'Neuropsychology',
    evidence: [],
    discrepancies: [],
    questions: [],
    generatedAt: '2026-10-20T00:00:00.000Z',
  };
  const record = (
    id: string,
    title: string,
    url: string,
    level: MatchLevel,
  ): WebRecord => ({
    id,
    url,
    title,
    kind: 'news',
    snippet: null,
    summary: `${title} summary`,
    publishedAt: '2026-09-01T00:00:00.000Z',
    retrievedAt: '2026-10-20T00:00:00.000Z',
    searchProviders: ['gemini'],
    queries: [],
    read: 'read',
    readNote: null,
    match: {
      level,
      confidence: 'high',
      basis: ['name', 'specialty'],
      conflicts: [],
      quote: 'Dr. Jason A. Demery testified',
      quoteVerified: true,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims: [],
  });

  it('lists same-name candidates separately and works without a city', () => {
    const subject = record(
      'r1',
      'Court TV article',
      'https://courttv.example/a',
      'strong',
    );
    const other = record(
      'r2',
      'Another Jason Demery',
      'https://other.example/b',
      'other_person',
    );
    const document = buildEwiReportDocument({
      ...base,
      city: '',
      additionalContext: 'Also known as J. Demery\nGainesville clinic',
      webResearch: {
        ranAt: '2026-10-20T00:00:00.000Z',
        durationMs: 1000,
        partial: false,
        partialNote: null,
        queriesPlanned: 4,
        queriesRun: 4,
        providers: [
          {
            providerId: 'gemini',
            name: 'Gemini Search',
            configured: true,
            requests: 4,
            hits: 7,
            failures: [],
          },
        ],
        pagesRead: 2,
        pagesBlocked: [
          { url: 'https://blocked.example/x', reason: 'Login required' },
        ],
        candidates: [
          {
            id: 'c1',
            label: 'Jason A. Demery, PhD, neuropsychologist',
            role: 'subject',
            confidence: 'high',
            basis: ['name', 'specialty'],
            recordIds: ['r1'],
          },
          {
            id: 'c2',
            label: 'Jason Demery, contractor',
            role: 'other',
            confidence: 'medium',
            basis: ['name'],
            recordIds: ['r2'],
          },
        ],
        records: [subject, other],
        registries: [],
        limitations: ['Social platforms were not opened.'],
      } as never,
    });
    const section = document.sections.find((s) => s.id === 'web-research');
    const text = section?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(section?.title).toBe('39. Other People with This Name');
    expect(text).toContain('other person');
    expect(text).toContain('Jason Demery, contractor — a different person');
    expect(text).toContain('Nothing below is attributed to the expert');
    expect(text).not.toContain('Search coverage');
    expect(text).not.toContain('search request(s) were sent');
    expect(text).toContain('Also known as J. Demery');
    expect(text).toContain('Login required');
    expect(
      document.sections.find((s) => s.id === 'city')?.blocks[0]?.text,
    ).toMatch(/Not provided/);
    expect(document.subtitle).toBe('Jason A. Demery — Neuropsychology');
  });

  it('lists search-found social accounts in Social Media', () => {
    const document = buildEwiReportDocument({
      ...base,
      city: 'Cleveland, OH',
      webResearch: {
        ranAt: '2026-10-20T00:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 1,
        queriesRun: 1,
        providers: [],
        pagesRead: 0,
        pagesBlocked: [],
        candidates: [],
        records: [
          {
            ...record(
              'x1',
              '@ClevelandClinic',
              'https://x.com/ClevelandClinic',
              'possible',
            ),
            kind: 'social',
            platform: 'x',
            snippet: 'X / Twitter: @ClevelandClinic',
            read: 'restricted',
          },
          {
            ...record(
              'li1',
              'cleveland-clinic',
              'https://www.linkedin.com/company/cleveland-clinic',
              'possible',
            ),
            kind: 'social',
            platform: 'linkedin',
            snippet: 'LinkedIn: Cleveland Clinic',
            read: 'restricted',
          },
        ],
        registries: [],
        limitations: [],
      },
    });
    const text =
      document.sections
        .find((s) => s.id === 'social')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(text).toContain('https://x.com/ClevelandClinic');
    expect(text).toContain('linkedin.com/company/cleveland-clinic');
    expect(text).toMatch(/institutional/i);
    expect(text).not.toMatch(/did not establish a public social media profile/);
  });

  it('puts a sourced photo on the cover when web research found one', () => {
    const document = buildEwiReportDocument({
      ...base,
      webResearch: {
        ranAt: '2026-10-20T00:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 1,
        queriesRun: 1,
        providers: [],
        pagesRead: 1,
        pagesBlocked: [],
        candidates: [],
        records: [],
        registries: [],
        limitations: [],
        portrait: {
          dataUrl: 'data:image/png;base64,aaa',
          mimeType: 'image/png',
          sourceUrl: 'https://clinic.example/about',
          imageUrl: 'https://clinic.example/jason.png',
        },
      },
    });
    expect(document.metadata?.coverImage).toEqual({
      dataUrl: 'data:image/png;base64,aaa',
      sourceUrl: 'https://clinic.example/about',
    });
  });

  it('says the web search did not run instead of claiming nothing exists', () => {
    const document = buildEwiReportDocument({
      ...base,
      city: 'Gainesville, FL',
    });
    const text =
      document.sections
        .find((s) => s.id === 'web-research')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(text).toMatch(/did not run/);
    expect(text).not.toMatch(/not a finding that none exist/);
  });
});

describe('EWI report source coverage', () => {
  it('distinguishes searched, unimplemented, failed, and blocked sources', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-21T00:00:00.000Z',
      sourceStatuses: [
        {
          sourceId: 'pubmed',
          status: 'no_result',
          coverage: 'searched_no_results',
          itemCount: 0,
          checked: true,
        },
        {
          sourceId: 'patents',
          status: 'unavailable',
          coverage: 'not_implemented',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'google_maps',
          status: 'unavailable',
          coverage: 'not_configured',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'criminal_records',
          status: 'error',
          coverage: 'failed',
          itemCount: 0,
          checked: true,
        },
        {
          sourceId: 'depositions',
          status: 'unavailable',
          coverage: 'not_implemented',
          itemCount: 0,
          checked: false,
        },
      ],
    });
    const patents =
      document.sections
        .find((section) => section.id === 'patents')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(patents).toMatch(/not implemented/i);
    expect(patents).not.toMatch(/returned no matching record/i);
    const publications =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(publications).toMatch(/returned no matching record/i);
    const maps =
      document.sections
        .find((section) => section.id === 'office-location')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(maps).toMatch(/not configured/i);
    const criminal =
      document.sections
        .find((section) => section.id === 'criminal')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(criminal).toMatch(/failed technically/i);
    expect(criminal).not.toMatch(/no criminal record/i);
    const depositions =
      document.sections
        .find((section) => section.id === 'depositions')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(depositions).toMatch(/not implemented/i);
    expect(depositions).not.toMatch(/CourtListener/i);
  });

  it('does not call a public patent search unimplemented', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T00:00:00.000Z',
      sourceStatuses: [
        {
          sourceId: 'patents',
          status: 'unavailable',
          coverage: 'not_implemented',
          itemCount: 0,
          checked: false,
        },
      ],
      webResearch: {
        ranAt: '2026-10-26T00:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 4,
        queriesRun: 4,
        providers: [
          {
            providerId: 'gemini_grounding',
            name: 'Gemini',
            configured: true,
            requests: 4,
            failedRequests: 0,
            hits: 0,
            failures: [],
          },
        ],
        pagesRead: 0,
        pagesBlocked: [],
        candidates: [],
        records: [],
        registries: [],
        limitations: [],
        topics: [{ topic: 'patents', queries: 2, hits: 0 }],
      } as never,
    });
    const patents =
      document.sections
        .find((section) => section.id === 'patents')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(patents).toMatch(/dedicated search for this topic ran/i);
    expect(patents).toMatch(/public web search for patents/i);
    expect(patents).not.toMatch(/not implemented/i);
  });

  it('prints pending, never-sent Lexis, explicit no-results, and an access wall differently', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-22T00:00:00.000Z',
      sourceStatuses: [
        {
          sourceId: 'youtube',
          status: 'ok',
          coverage: 'pending',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'pubmed',
          status: 'no_result',
          coverage: 'searched_no_results',
          itemCount: 0,
          checked: true,
        },
        {
          sourceId: 'lexisnexis',
          status: 'unavailable',
          coverage: 'not_implemented',
          message:
            'Not searched. LexisNexis is restricted. No request was sent.',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'justia',
          status: 'error',
          coverage: 'blocked_or_access_denied',
          message: 'Justia presented a bot-protection or access wall.',
          itemCount: 0,
          checked: true,
        },
      ],
    });
    const videos =
      document.sections
        .find((section) => section.id === 'videos')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(videos).toMatch(/has not been searched yet/i);
    expect(videos).not.toMatch(/returned no matching record/i);
    const publications =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(publications).toMatch(/returned no matching record/i);
    const lawsuits =
      document.sections
        .find((section) => section.id === 'lawsuits')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(lawsuits).toMatch(/LexisNexis is not implemented/i);
    expect(lawsuits).not.toMatch(/LexisNexis could not be accessed/i);
    expect(lawsuits).toMatch(/Justia could not be accessed/i);
    expect(lawsuits).not.toMatch(/no request was sent/i);
  });

  it('does not treat a global web run as a review of every category', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-21T00:00:00.000Z',
      webResearch: {
        ranAt: '2026-10-21T00:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 8,
        queriesRun: 8,
        providers: [
          {
            providerId: 'gemini_grounding',
            name: 'Google Search via Gemini grounding',
            configured: true,
            requests: 8,
            failedRequests: 0,
            hits: 0,
            failures: [],
          },
        ],
        pagesRead: 0,
        pagesBlocked: [],
        candidates: [],
        records: [],
        registries: [],
        limitations: [],
        topics: [{ topic: 'identity', queries: 1, hits: 0 }],
      },
    });
    const education =
      document.sections
        .find((section) => section.id === 'education')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(education).toMatch(/was not searched/i);
    expect(education).not.toMatch(/did not establish/i);
    const criminal =
      document.sections
        .find((section) => section.id === 'criminal')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(criminal).toMatch(/was not searched/i);
    expect(criminal).not.toMatch(/did not establish/i);
    expect(criminal).not.toMatch(/no criminal/i);
  });

  it('does not count a web coverage summary as evidence found', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'web_search',
          category: 'web',
          title: 'Web research coverage',
          summary:
            '8 searches across Google Search via Gemini grounding; 0 pages read; 0 pages matched to the subject.',
          informationStatus: 'unverified',
          source: {
            providerId: 'web_search',
            name: 'Web search',
            retrievedAt: '2026-10-21T00:00:00.000Z',
            access: 'public',
          },
          raw: {
            webSummary: { queriesRun: 8, pagesRead: 0, partial: false },
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-21T00:00:00.000Z',
      summary: '1 item(s) were collected from the sources searched.',
      sourceStatuses: [
        {
          sourceId: 'web_search',
          status: 'no_result',
          coverage: 'searched_no_results',
          itemCount: 1,
          checked: true,
        },
      ],
    });
    expect(document.highlights?.[0]).toBe('0 collected items');
    const summary =
      document.sections
        .find((section) => section.id === 'summary')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(summary).not.toMatch(/1 item\(s\) were collected/);
    const misc =
      document.sections
        .find((section) => section.id === 'misc')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(misc).not.toMatch(/Additional relevant findings/);
    const publications =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(publications).not.toMatch(/did not establish/i);
  });

  it('separates official Florida license verification from NPPES and does not treat a blocked Justia page as an empty search', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jason Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
      evidence: [
        {
          sourceId: 'npi_registry',
          category: 'license',
          title: 'Licenses reported to the NPI Registry',
          summary: 'FL PY7500. Self-reported to NPPES.',
          informationStatus: 'unverified',
          raw: {
            verificationStatus: 'nppes_self_reported',
            nppesLicenses: [{ state: 'FL', number: 'PY7500' }],
          },
        },
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'Florida DOH license PY7500: Clear/Active',
          summary:
            'Official Florida Department of Health license lookup listed DEMERY, JASON A.',
          url: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
          informationStatus: 'verified',
          retrievedAt: '2026-10-21T00:00:00.000Z',
          source: {
            providerId: 'state_license',
            name: 'State medical licenses',
            url: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
            retrievedAt: '2026-10-21T00:00:00.000Z',
            access: 'public',
          },
          raw: {
            verificationStatus: 'official_verified',
            licenseNumber: 'PY7500',
            documentType: 'license',
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-21T00:00:00.000Z',
      sourceStatuses: [
        {
          sourceId: 'state_license',
          status: 'ok',
          coverage: 'searched_with_results',
          itemCount: 1,
          checked: true,
        },
        {
          sourceId: 'justia',
          status: 'error',
          coverage: 'blocked_or_access_denied',
          message: 'Justia presented a bot-protection or access wall.',
          itemCount: 0,
          checked: true,
        },
        {
          sourceId: 'depositions',
          status: 'unavailable',
          coverage: 'not_implemented',
          itemCount: 0,
          checked: false,
        },
      ],
    });
    const licenses =
      document.sections
        .find((section) => section.id === 'licenses')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(licenses).toMatch(/official regulator record matched/i);
    expect(licenses).toMatch(/License number: PY7500/);
    expect(licenses).toMatch(/self-reported to NPPES/i);
    const lawsuits =
      document.sections
        .find((section) => section.id === 'lawsuits')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(lawsuits).toMatch(/could not be accessed/i);
    expect(lawsuits).not.toMatch(
      /Justia was searched and returned no matching record/i,
    );
    const depositions =
      document.sections
        .find((section) => section.id === 'depositions')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(depositions).toMatch(/not implemented/i);
  });

  it('does not use a news article as official license verification', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
      evidence: [
        {
          sourceId: 'news',
          category: 'license',
          title: 'Local news notes a Florida psychology license',
          summary: 'A news article mentioned license PY7500.',
          url: 'https://news.example/demery-license',
          informationStatus: 'unverified',
          raw: { web: { kind: 'news' } },
        },
        {
          sourceId: 'other_public_websites',
          category: 'license',
          title: 'WebMD license blurb',
          summary:
            'Dr. Jason A Demery holds an active medical license in the state of Florida.',
          url: 'https://doctor.webmd.com/doctor/jason-demery',
          informationStatus: 'unverified',
        },
        {
          sourceId: 'npi_registry',
          category: 'license',
          title: 'Licenses reported to the NPI Registry',
          summary: 'FL PY7500. Self-reported to NPPES.',
          informationStatus: 'unverified',
          raw: { verificationStatus: 'nppes_self_reported' },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-22T00:00:00.000Z',
    });
    const licenses =
      document.sections
        .find((section) => section.id === 'licenses')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(licenses).toMatch(/self-reported to NPPES/i);
    expect(licenses).not.toMatch(/Local news notes/);
    expect(licenses).not.toMatch(/news.example/);
    expect(licenses).not.toMatch(/WebMD license blurb/);
    expect(licenses).not.toMatch(/webmd.com/);
  });

  it('prints PubMed author order without calling first position a lead-author designation', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, Florida',
      specialty: 'Neuropsychologist',
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title:
            'Operating characteristics of executive functioning tests following traumatic brain injury.',
          summary: 'PubMed article.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21069617/',
          informationStatus: 'unverified',
          raw: {
            pmid: '21069617',
            authors: [
              'Demery JA',
              'Larson MJ',
              'Dixit NK',
              'Bauer RM',
              'Perlstein WM',
            ],
            identity: { name: 'Jason A. Demery' },
          },
        },
        {
          sourceId: 'pubmed',
          category: 'publication',
          title:
            'Domestic Homicide: Neuropsychological Profiles of Murderers Who Kill Family Members',
          summary: 'PubMed article.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26292990/',
          informationStatus: 'unverified',
          raw: {
            pmid: '26292990',
            authors: ['Hanlon RE', 'Brook M', 'Demery JA', 'Cunningham MD'],
            identity: { name: 'Jason A. Demery' },
          },
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-22T00:00:00.000Z',
    });
    const publications =
      document.sections
        .find((section) => section.id === 'publications')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(publications).toMatch(/PMID: 21069617/);
    expect(publications).toMatch(/first of 5 authors/);
    expect(publications).toMatch(/PMID: 26292990/);
    expect(publications).toMatch(/author 3 of 4/);
    expect(publications).toMatch(/list position, not a publisher designation/i);
    expect(publications).not.toMatch(/First\/lead author status: not stated/i);
    const grants =
      document.sections
        .find((section) => section.id === 'grants')
        ?.blocks.map((block) => block.text)
        .join(' ') ?? '';
    expect(grants).not.toMatch(/K01 MH001857|21069617/);
  });

  it('prints uploaded-document page citations and question evidence links', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'CA License',
          summary:
            'California psychologist license PSY12345 is active and was issued in 2009.',
          url: 'https://example.test/license',
          informationStatus: 'verified',
          identityMatch: 'matched',
          source: {
            providerId: 'state_license',
            name: 'California DCA',
            retrievedAt: '2026-10-01T00:00:00.000Z',
            access: 'public',
          },
          raw: { licenseNumber: 'PSY12345', cvPage: 2 },
        },
      ],
    });
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'CA License',
          summary:
            'California psychologist license PSY12345 is active and was issued in 2009.',
          url: 'https://example.test/license',
          informationStatus: 'verified',
          identityMatch: 'matched',
          source: {
            providerId: 'state_license',
            name: 'California DCA',
            retrievedAt: '2026-10-01T00:00:00.000Z',
            access: 'public',
          },
          raw: { licenseNumber: 'PSY12345', cvPage: 2 },
        },
      ],
      discrepancies: [],
      questions,
      generatedAt: '2026-10-21T00:00:00.000Z',
    });
    const licenses =
      document.sections
        .find((section) => section.id === 'licenses')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(licenses).toMatch(/Uploaded document page: 2/);
    expect(licenses).toMatch(/not an independent verification/);
    const questionsText =
      document.sections
        .find((section) => section.id === 'questions')
        ?.blocks.map((block) => block.text)
        .join('\n') ?? '';
    expect(questions).toHaveLength(1);
    expect(questionsText).toMatch(/^1 cross-examination question/);
    expect(questionsText).toContain(questions[0].question);
    expect(questionsText).toMatch(/Sourced fact/);
    expect(questionsText).toContain('https://example.test/license');
    expect(document.highlights?.[2]).toBe('1 cross-examination question');
  });
});
