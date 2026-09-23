import { buildGroundedCrossExamQuestions } from './ewi-report-questions';
import {
  EWI_REPORT_SECTIONS,
  buildEwiReportDocument,
} from './ewi-report.template';
import { DocxReportRenderer } from '@platform/report/docx-report.renderer';

describe('EWI report template', () => {
  const renderer = new DocxReportRenderer();

  it('includes every report section and does not invent an empty section', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
      specialty: 'Neurology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    expect(document.sections.map((section) => section.title)).toEqual(
      EWI_REPORT_SECTIONS.map((section) => section.title),
    );
    expect(document.templateVersion).toBe('1.0.0');
    const boards = document.sections.find((section) => section.id === 'boards');
    expect(boards?.blocks.map((block) => block.text).join(' ')).toMatch(
      /could not be verified/i,
    );
    expect(
      document.sections.find((section) => section.id === 'questions')?.blocks[0]
        ?.text,
    ).toMatch(/facts were not invented/i);
  });

  it('keeps restricted source text out of the report and links the public URL', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Doe',
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
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-09-23T00:00:00.000Z',
    });

    const legal = document.sections.find((section) => section.id === 'legal');
    const text = legal?.blocks.map((block) => block.text).join('\n') ?? '';
    expect(text).toContain('Licensed opinion index');
    expect(text).not.toContain('licensed paragraph');
    expect(text).toMatch(/authorized access/i);
    expect(
      legal?.blocks.some(
        (block) => block.link === 'https://www.lexisnexis.com/example',
      ),
    ).toBe(true);
  });

  it('writes a Word document whose bytes are a docx package', async () => {
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
    expect(rendered.templateVersion).toBe('1.0.0');
    expect(rendered.mimeType).toContain('wordprocessingml');
  });
});
