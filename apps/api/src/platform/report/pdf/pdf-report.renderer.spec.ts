import type { ReportBlock, ReportDocumentModel } from '../report-document';
import { PdfReportRenderer } from './pdf-report.renderer';
import { photoSourceLabel, safeLink } from '../report-text';
import { wrapText } from './pdf-text';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocument = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
type PageRef = Parameters<PdfDocument['getPageIndex']>[0];

const LONG_URL = `https://example.com/records/${'segment/'.repeat(30)}end`;

async function openPdf(buffer: Buffer): Promise<PdfDocument> {
  const pdfjs: PdfJs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    verbosity: 0,
  }).promise;
}

async function pageTexts(pdf: PdfDocument): Promise<string[]> {
  const texts: string[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent();
    texts.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' '),
    );
  }
  return texts;
}

async function links(
  pdf: PdfDocument,
): Promise<Array<{ url?: string; dest?: unknown }>> {
  const found: Array<{ url?: string; dest?: unknown }> = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const annotations = (await (
      await pdf.getPage(number)
    ).getAnnotations()) as Array<{
      subtype?: string;
      url?: string;
      dest?: unknown;
    }>;
    found.push(...annotations.filter((item) => item.subtype === 'Link'));
  }
  return found;
}

/** 1-based page of a section's named destination. */
async function destinationPage(
  pdf: PdfDocument,
  name: string,
): Promise<number> {
  const destination = (await pdf.getDestination(name)) as unknown[] | null;
  if (!destination) throw new Error(`No destination ${name}`);
  return (await pdf.getPageIndex(destination[0] as PageRef)) + 1;
}

function questions(count: number): ReportBlock[] {
  return Array.from({ length: count }, (_, index) => [
    {
      text: `${index + 1}. Question number ${index + 1} about the record?`,
      style: 'item' as const,
    },
    { text: `Basis: finding f${index + 1}`, style: 'citation' as const },
  ]).flat();
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
    fileName: 'test-report.docx',
    generatedAt: '2026-10-15T09:10:00.000Z',
    mimeType: 'application/pdf',
    format: 'pdf',
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
          { text: 'Field: value' },
          { text: LONG_URL, link: LONG_URL, style: 'citation' },
          {
            text: 'javascript:alert(1)',
            link: 'javascript:alert(1)',
            style: 'citation',
          },
        ],
      },
      {
        id: 'questions',
        title: '4. Questions',
        icon: 'gavel',
        blocks: questions(40),
      },
    ],
    ...overrides,
  };
}

describe('PdfReportRenderer', () => {
  const renderer = new PdfReportRenderer();
  jest.setTimeout(20_000);

  it('renders a text PDF with a cover, contents, section cards, and page footers', async () => {
    const artifact = await renderer.render(model());
    const pdf = await openPdf(artifact.buffer);
    const pages = await pageTexts(pdf);
    const all = pages.join('\n');

    expect(artifact.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.format).toBe('pdf');
    expect(artifact.fileName).toBe('test-report.pdf');
    expect(pages[0]).toContain('TEST INVESTIGATION REPORT');
    expect(pages[0]).toContain('Łucja Nowak-São');
    expect(pages[0]).toContain('Neurology · Kraków');
    expect(pages[0]).toContain('Summary line ≥ one.');
    expect(pages[0]).toContain('2 collected items');
    expect(all).toContain('Contents');
    expect(all).toContain('Record title');
    expect(all).toContain('40. Question number 40 about the record?');
    expect(all).toContain('4. Questions (continued)');
    expect(all).toContain('Research compilation only.');
    expect(all).toContain(
      'Test Product · Report generated Oct 15, 2026, 9:10 AM UTC · test/report 1.2.3',
    );
    pages.forEach((page, index) =>
      expect(page).toContain(`Page ${index + 1} of ${pages.length}`),
    );
  });

  it('lists each section in the contents with the page it starts on', async () => {
    const pdf = await openPdf((await renderer.render(model())).buffer);
    const [cover] = await pageTexts(pdf);

    for (const [title, id] of [
      ['2. Executive Summary', 'summary'],
      ['3. Records', 'records'],
      ['4. Questions', 'questions'],
    ]) {
      const listed = new RegExp(`${title.replace('.', '\\.')} (\\d+)`).exec(
        cover,
      );
      expect(Number(listed?.[1])).toBe(
        await destinationPage(pdf, `section-${id}`),
      );
    }
    expect(await destinationPage(pdf, 'section-summary')).toBe(1);
  });

  it('makes only web and mail addresses clickable', async () => {
    const pdf = await openPdf((await renderer.render(model())).buffer);
    const found = await links(pdf);
    const pages = await pageTexts(pdf);

    expect(found.some((link) => link.url === LONG_URL)).toBe(true);
    expect(found.some((link) => link.url?.startsWith('javascript'))).toBe(
      false,
    );
    // Still printed, as text.
    expect(pages.join('\n')).toContain('javascript:alert(1)');
    // Contents entries jump to their section.
    expect(found.some((link) => link.dest === 'section-questions')).toBe(true);
  });

  it('prints a sourced cover photo caption', async () => {
    const base = model();
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const artifact = await renderer.render({
      ...base,
      metadata: {
        ...base.metadata,
        coverImage: {
          dataUrl: png,
          sourceUrl: 'https://clinic.example/about',
        },
      },
    });
    const pages = await pageTexts(await openPdf(artifact.buffer));
    expect(pages[0]).toContain('Photo from clinic.example');
  });

  it('moves a summary too long for the cover into its own card', async () => {
    const longSummary = Array.from(
      { length: 80 },
      (_, index) => `Summary sentence ${index + 1} of a very long summary.`,
    ).join('\n');
    const base = model();
    const pdf = await openPdf(
      (
        await renderer.render({
          ...base,
          sections: base.sections.map((section) =>
            section.id === 'summary'
              ? { ...section, blocks: [{ text: longSummary }] }
              : section,
          ),
        })
      ).buffer,
    );
    const pages = await pageTexts(pdf);
    const all = pages.join('\n');
    const cover = pages[0].slice(0, pages[0].indexOf('Contents'));

    expect(cover).toContain('Łucja Nowak-São');
    expect(cover).not.toContain('Summary sentence');
    // A card after the contents, continued across pages.
    expect(all.indexOf('Summary sentence 1 ')).toBeGreaterThan(
      all.indexOf('Contents'),
    );
    expect(all).toContain('2. Executive Summary (continued)');
    expect(all).toContain('Summary sentence 80 of a very long summary.');
  });
});

describe('wrapText', () => {
  // Every character is 5 points wide.
  const measure = (text: string) => text.length * 5;

  it('breaks at spaces and keeps line breaks', () => {
    expect(wrapText('one two three four\nfive', 50, measure)).toEqual([
      'one two',
      'three four',
      'five',
    ]);
  });

  it('splits a long URL after a separator and never exceeds the width', () => {
    const lines = wrapText(`See ${LONG_URL}`, 200, measure);
    expect(lines.join('')).toBe(`See${LONG_URL}`);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(200);
    expect(lines.slice(1, -1).every((line) => line.endsWith('/'))).toBe(true);
  });

  it('hard-breaks a long alphabetic word without inserting a hyphen', () => {
    const lines = wrapText('neuropsychological', 50, measure);
    expect(lines.some((line) => line.endsWith('-'))).toBe(false);
    expect(lines.join('')).toBe('neuropsychological');
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(50);
  });

  it('drops characters that have no glyph', () => {
    expect(wrapText('a\u0000b​c﻿', 100, measure)).toEqual(['abc']);
  });
});

describe('photoSourceLabel', () => {
  it('names the host the photo was taken from', () => {
    expect(photoSourceLabel('https://www.clinic.example/about')).toBe(
      'Photo from clinic.example',
    );
    expect(photoSourceLabel(undefined)).toBeNull();
  });
});

describe('safeLink', () => {
  it('allows web and mail links only', () => {
    expect(safeLink(' https://example.com/a ')).toBe('https://example.com/a');
    expect(safeLink('http://example.com')).toBe('http://example.com');
    expect(safeLink('mailto:clerk@example.com')).toBe(
      'mailto:clerk@example.com',
    );
    expect(safeLink('javascript:alert(1)')).toBeUndefined();
    expect(safeLink('file:///etc/passwd')).toBeUndefined();
    expect(safeLink('data:text/html,hi')).toBeUndefined();
    expect(safeLink('/relative/path')).toBeUndefined();
    expect(safeLink(undefined)).toBeUndefined();
  });
});
