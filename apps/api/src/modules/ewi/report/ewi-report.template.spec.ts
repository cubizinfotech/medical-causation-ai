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
    expect(text).toMatch(/First\/lead author status: yes/);
    expect(text).toMatch(/Retraction status: none stated/);
    expect(text).not.toMatch(/page 47|p\.\s*12/i);
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
      `1. [Unresolved] ${questions[0].question}`,
      'Disclaimer',
    ]) {
      expect(text).toContain(expected);
    }
    expect(html).toContain('<a href="https://linkedin.example/jane">');
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
