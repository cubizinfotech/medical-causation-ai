import { inflateRawSync } from 'node:zlib';
import mammoth from 'mammoth';
import type { ReportDocumentModel } from '../report-document';
import { DOCX_MIME_TYPE, DocxReportRenderer } from './docx-report.renderer';

const LINK = 'https://example.com/records/1';
/** A NUL byte from a scanned source: not allowed in Word's XML. */
const NUL = String.fromCharCode(0);

/** One file of a .docx (a zip), as text. */
function zipEntry(buffer: Buffer, wanted: string): string {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const size = buffer.readUInt32LE(offset + 20);
      const start =
        local +
        30 +
        buffer.readUInt16LE(local + 26) +
        buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return (
        buffer.readUInt16LE(offset + 10) === 8 ? inflateRawSync(data) : data
      ).toString('utf8');
    }
    offset += 46 + nameLength + extra + comment;
  }
  throw new Error(`${wanted} not found`);
}

/** The text runs of word/document.xml, each with whether Word spell-checks it. */
function documentRuns(
  buffer: Buffer,
): Array<{ text: string; noProof: boolean }> {
  const xml = zipEntry(buffer, 'word/document.xml');
  return [...xml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)].map((match) => ({
    text: [...match[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((part) => part[1])
      .join(''),
    noProof: match[1].includes('<w:noProof/>'),
  }));
}

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

  it('does not spell-check identifiers, references, and links', async () => {
    const base = model();
    const runs = documentRuns(
      (
        await renderer.render({
          ...base,
          noProofTerms: ['courtlistener'],
          sections: [
            ...base.sections,
            {
              id: 'questions',
              title: '4. Questions',
              blocks: [
                {
                  text: 'Why was no board_certification evidence retrieved from source:board_certification?',
                  style: 'item',
                },
                {
                  text: 'Basis: source:pubmed — Source was unavailable.',
                  style: 'citation',
                },
                {
                  text: '13. [courtlistener] Smith v. Jones — access: public',
                  style: 'item',
                },
                {
                  text: 'From the abstract: mTBI raised the risk.',
                  noProof: true,
                },
              ],
            },
          ],
        })
      ).buffer,
    );
    const noProof = (whole: string) =>
      runs.filter((item) => item.text === whole).map((item) => item.noProof);
    const startingWith = (part: string) =>
      runs
        .filter((item) => item.text.startsWith(part))
        .map((item) => item.noProof);

    // Underscore names and source references are left alone by spell check.
    expect(noProof('board_certification')).toEqual([true]);
    expect(noProof('source:board_certification?')).toEqual([true]);
    // Ordinary words in the same sentence are still checked.
    expect(noProof('Why was no ')).toEqual([false]);
    expect(noProof(' evidence retrieved from ')).toEqual([false]);
    // Source lines and links are never checked.
    expect(startingWith('Basis: ').length).toBeGreaterThan(0);
    expect(startingWith('Basis: ').every(Boolean)).toBe(true);
    expect(noProof(LINK)).toEqual([true]);
    // A model's names, with the brackets Word reads as part of the word.
    expect(noProof('[courtlistener]')).toEqual([true]);
    expect(noProof(' Smith v. Jones — access: public')).toEqual([false]);
    // A block quoted from a source is not checked at all.
    expect(noProof('From the abstract: mTBI raised the risk.')).toEqual([true]);
    // The template id in the closing line is a path.
    expect(noProof('test/report')).toEqual([true]);
  });

  it('marks the document as US English', async () => {
    // Word checked it as British English and marked "Center" in names.
    const buffer = (await renderer.render(model())).buffer;
    expect(zipEntry(buffer, 'word/styles.xml')).toContain(
      '<w:lang w:val="en-US"/>',
    );
  });
});
