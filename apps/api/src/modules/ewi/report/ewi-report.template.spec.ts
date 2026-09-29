import { buildGroundedCrossExamQuestions } from './ewi-report-questions';
import {
  EWI_REPORT_SECTIONS,
  buildEwiReportDocument,
} from './ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from './ewi-report.version';
import { EwiWordReportService } from './ewi-word-report.service';
import { DocxReportRenderer } from '@platform/report/docx-report.renderer';

describe('EWI report template', () => {
  const renderer = new DocxReportRenderer();

  it('includes the full 40-section outline with metadata, TOC, version, and disclaimer', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    expect(document.sections).toHaveLength(40);
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
    ).toMatch(/Jane Doe/);
    expect(
      document.sections
        .find((section) => section.id === 'board-certifications')
        ?.blocks.map((block) => block.text)
        .join(' '),
    ).toMatch(/could not be verified/i);
    expect(
      document.sections.find((section) => section.id === 'questions')?.blocks[0]
        ?.text,
    ).toMatch(/facts were not invented/i);
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

  it('writes a Word document whose bytes are a docx package with at least 100 questions', async () => {
    const evidence = [
      {
        sourceId: 'pubmed' as const,
        category: 'publication',
        title: 'Development fixture: spine study',
        summary: 'Development fixture only.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
        access: 'public' as const,
        informationStatus: 'unverified' as const,
      },
    ];
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
      summary: 'The collected publication record could not be verified.',
    });
    const rendered = await renderer.render(document);

    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(rendered.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(rendered.buffer.byteLength).toBeGreaterThan(1000);
    expect(rendered.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(rendered.mimeType).toContain('wordprocessingml');
  });
});

describe('EwiWordReportService', () => {
  it('builds a professionally formatted docx through the shared renderer', async () => {
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
      summary: 'Collected social listing could not be verified.',
    });

    expect(artifact.format).toBe('docx');
    expect(artifact.templateId).toBe('ewi/investigation-report');
    expect(artifact.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(artifact.fileName).toMatch(/ewi-jane-doe-report\.docx/);
    expect(artifact.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(artifact.buffer.byteLength).toBeGreaterThan(2000);
  });
});
