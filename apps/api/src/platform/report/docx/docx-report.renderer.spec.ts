import mammoth from 'mammoth';
import type { ReportDocumentModel } from '../report-document';
import { DOCX_MIME_TYPE, DocxReportRenderer } from './docx-report.renderer';

const LINK = 'https://example.com/records/1';
/** A NUL byte from a scanned source: not allowed in Word's XML. */
const NUL = String.fromCharCode(0);

function model(
  overrides: Partial<ReportDocumentModel> = {},
): ReportDocumentModel {
  return {
    product: 'ewi',
    templateId: 'test/report',
    templateVersion: '1.2.3',
    title: 'Test Investigation Report',
    headerLabel: 'Test Product',
    fileName: 'test-report.pdf',
    generatedAt: '2026-10-15T09:10:00.000Z',
    mimeType: DOCX_MIME_TYPE,
    format: 'docx',
    includeTableOfContents: true,
    highlights: ['2 collected items', '40 questions'],
    metadata: {
      expertName: 'Łucja Nowak-São',
      city: 'Kraków',
      specialty: 'Neurology',
      disclaimer: 'Research compilation only.',
    },
    sections: [
      {
        id: 'name',
        title: '1. Expert Name',
        placement: 'cover-fact',
        blocks: [{ text: 'Łucja Nowak-São' }],
      },
      {
        id: 'summary',
        title: '2. Executive Summary',
        placement: 'cover-summary',
        blocks: [{ text: 'Summary line ≥ one.' }],
      },
      {
        id: 'records',
        title: '3. Records',
        icon: 'book-open',
        blocks: [
          { text: 'Intro note.', style: 'note' },
          { text: 'Record title', style: 'subheading' },
          { text: `Field: value${NUL} with a NUL` },
          { text: LINK, link: LINK, style: 'citation' },
          {
            text: 'javascript:alert(1)',
            link: 'javascript:alert(1)',
            style: 'citation',
          },
          { text: 'Grouped questions', style: 'heading' },
          { text: '1. First question?', style: 'item' },
          { text: 'Basis: f1', style: 'citation' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('DocxReportRenderer', () => {
  const renderer = new DocxReportRenderer();

  it('writes a Word file with the cover, sections, boxes, and disclaimer', async () => {
    const artifact = await renderer.render(model());
    const { value: text } = await mammoth.extractRawText({
      buffer: artifact.buffer,
    });

    expect(artifact.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(artifact.mimeType).toBe(DOCX_MIME_TYPE);
    expect(artifact.format).toBe('docx');
    expect(artifact.fileName).toBe('test-report.docx');
    for (const expected of [
      'TEST INVESTIGATION REPORT',
      'Generated Oct 15, 2026, 9:10 AM UTC · Report 1.2.3',
      'Łucja Nowak-São',
      'Neurology · Kraków',
      '1. Expert Name',
      '2. Executive Summary',
      'Summary line ≥ one.',
      '2 collected items',
      'Contents',
      '3. Records',
      'Record title',
      'Field: value with a NUL',
      'Grouped questions',
      '1. First question?',
      'Disclaimer',
      'Research compilation only.',
      'Test Product · Report generated Oct 15, 2026, 9:10 AM UTC · test/report 1.2.3',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('makes only web and mail addresses clickable', async () => {
    const { value: html } = await mammoth.convertToHtml({
      buffer: (await renderer.render(model())).buffer,
    });

    expect(html).toContain(`<a href="${LINK}">`);
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('javascript:alert(1)');
  });

  it('leaves out the contents when the model does not ask for them', async () => {
    const withContents = await renderer.render(model());
    const without = await renderer.render(
      model({ includeTableOfContents: false }),
    );
    const text = (buffer: Buffer) =>
      mammoth.extractRawText({ buffer }).then((result) => result.value);

    expect(await text(withContents.buffer)).toContain('Contents');
    expect(await text(without.buffer)).not.toContain('Contents');
  });
});
