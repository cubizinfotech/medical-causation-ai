import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import type { ReportArtifact } from '../report.types';
import type {
  ReportBlock,
  ReportDocumentModel,
  ReportSectionModel,
} from '../report-document';
import { formatGeneratedAt, printableText, safeLink } from '../report-text';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const FONT = 'Calibri';
/** Colors of the PDF report (see pdf/pdf-theme.ts), without the "#". */
const COLOR = {
  text: '0F172A',
  body: '1E293B',
  muted: '475569',
  faint: '64748B',
  primary: '0F766E',
  border: 'CBD5E1',
  borderLight: 'E2E8F0',
  band: 'F1F5F9',
  coverFill: 'ECFDF5',
  coverBorder: '5EEAD4',
  badge: 'E2E8F0',
};
/** Font sizes in half-points. */
const SIZE = {
  body: 21,
  note: 19,
  citation: 18,
  small: 16,
  heading: 26,
  subheading: 22,
  coverName: 40,
};
/** A4 with 0.6-inch margins, in twentieths of a point. */
const PAGE_MARGIN = 864;
const CONTENT_WIDTH = 11906 - PAGE_MARGIN * 2;

type Block = Paragraph | Table;

function border(color: string, size = 4) {
  return { style: BorderStyle.SINGLE, size, color };
}

function allBorders(color: string, size = 4) {
  const line = border(color, size);
  return { top: line, bottom: line, left: line, right: line };
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function run(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    color?: string;
    characterSpacing?: number;
    allCaps?: boolean;
    /** Word does not spell-check it (names and identifiers, not prose). */
    noProof?: boolean;
    /** Starts on a new line. */
    lineBreak?: boolean;
  } = {},
): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: options.size ?? SIZE.body,
    bold: options.bold,
    italics: options.italics,
    color: options.color ?? COLOR.body,
    characterSpacing: options.characterSpacing,
    allCaps: options.allCaps,
    noProof: options.noProof || undefined,
    break: options.lineBreak ? 1 : undefined,
  });
}

/**
 * Identifiers Word's spell check would mark with a red line: names with
 * underscores (board_certification), references such as source:pubmed,
 * paths such as ewi/investigation-report, and web addresses.
 */
const IDENTIFIERS =
  /https?:\/\/|www\.|_|\b[a-z][\w-]*:[\w./-]+|\b[\w-]+\/[\w./-]+/;

/**
 * What Word does not spell-check: words with an identifier or one of the
 * model's names in them. The whole word between spaces is matched, since
 * Word checks "[courtlistener]" with its brackets as one word.
 */
export function technicalWords(terms: readonly string[] = []): RegExp {
  const names = [...new Set(terms)]
    .filter((term) => /^[\w.-]+$/.test(term))
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.-]/g, (char) => `\\${char}`));
  const inner = [IDENTIFIERS.source];
  if (names.length > 0) inner.push(`\\b(?:${names.join('|')})\\b`);
  return new RegExp(`\\S*(?:${inner.join('|')})\\S*`, 'gi');
}

const DEFAULT_WORDS = technicalWords();

/** A line split into prose and identifiers (identifiers are not spell-checked). */
function segments(
  line: string,
  words: RegExp,
): Array<{ text: string; technical: boolean }> {
  const parts: Array<{ text: string; technical: boolean }> = [];
  let last = 0;
  for (const match of line.matchAll(words)) {
    if (match.index > last) {
      parts.push({ text: line.slice(last, match.index), technical: false });
    }
    parts.push({ text: match[0], technical: true });
    last = match.index + match[0].length;
  }
  if (last < line.length || parts.length === 0) {
    parts.push({ text: line.slice(last), technical: false });
  }
  return parts;
}

/** Text runs with the line breaks of `text` kept. */
function runs(
  text: string,
  options: Parameters<typeof run>[1] = {},
  words: RegExp = DEFAULT_WORDS,
): TextRun[] {
  return printableText(text)
    .split('\n')
    .flatMap((line, lineIndex) =>
      segments(line, words).map((segment, position) =>
        run(segment.text, {
          ...options,
          noProof: options.noProof || segment.technical,
          lineBreak: lineIndex > 0 && position === 0,
        }),
      ),
    );
}

/** One report block as a Word paragraph. */
function blockParagraph(
  block: ReportBlock,
  words: RegExp = DEFAULT_WORDS,
): Paragraph {
  const style = block.style ?? 'body';
  const text = (options: Parameters<typeof run>[1] = {}) =>
    runs(
      block.text,
      { ...options, noProof: options?.noProof || block.noProof },
      words,
    );
  const link = safeLink(block.link);
  const spacing = { after: 60, line: 276 };
  if (link) {
    return new Paragraph({
      spacing,
      children: [
        new ExternalHyperlink({
          link,
          children: [
            new TextRun({
              text: printableText(block.text),
              style: 'Hyperlink',
              font: FONT,
              size: SIZE.citation,
              color: COLOR.primary,
              noProof: true,
            }),
          ],
        }),
      ],
    });
  }
  switch (style) {
    case 'subheading':
      return new Paragraph({
        spacing,
        keepNext: true,
        children: text({
          bold: true,
          size: SIZE.subheading,
          color: COLOR.text,
        }),
      });
    case 'item':
      return new Paragraph({
        spacing,
        keepNext: true,
        children: text({ color: COLOR.text }),
      });
    case 'heading':
    case 'title':
    case 'subtitle':
      return new Paragraph({
        spacing: { before: 160, after: 80 },
        keepNext: true,
        children: text({
          bold: true,
          size: SIZE.subheading,
          color: COLOR.primary,
        }),
      });
    case 'note':
      return new Paragraph({
        spacing,
        children: text({ size: SIZE.note, color: COLOR.muted }),
      });
    case 'citation':
      // Source lines (references, sources, bases) are not spell-checked.
      return new Paragraph({
        spacing,
        children: text({
          size: SIZE.citation,
          color: COLOR.muted,
          noProof: true,
        }),
      });
    default:
      return new Paragraph({ spacing, children: text() });
  }
}

/** A bordered box (a record, a question), like the boxes in the PDF. */
function box(blocks: ReportBlock[], words: RegExp): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: {
      ...allBorders(COLOR.borderLight, 6),
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            margins: { top: 100, bottom: 60, left: 160, right: 160 },
            children: blocks.map((block) => blockParagraph(block, words)),
          }),
        ],
      }),
    ],
  });
}

/** Space between boxes (Word joins tables that touch). */
function gap(points = 5): Paragraph {
  return new Paragraph({
    spacing: {
      before: 0,
      after: 0,
      line: points * 20,
      lineRule: LineRuleType.EXACT,
    },
    children: [run('', { size: 2 })],
  });
}

/**
 * Section content: a 'subheading' or 'item' opens a box that holds the
 * blocks after it until the next box opens; a heading closes it (the same
 * rule as the PDF).
 */
function sectionContent(blocks: ReportBlock[], words: RegExp): Block[] {
  const content: Block[] = [];
  let open: ReportBlock[] | null = null;
  const closeBox = () => {
    if (!open) return;
    content.push(box(open, words), gap());
    open = null;
  };
  for (const block of blocks) {
    if (!block.text.trim()) continue;
    const style = block.style ?? 'body';
    if (style === 'subheading' || style === 'item') {
      closeBox();
      open = [block];
    } else if (
      style === 'heading' ||
      style === 'title' ||
      style === 'subtitle'
    ) {
      closeBox();
      content.push(blockParagraph(block, words));
    } else if (open) {
      open.push(block);
    } else {
      content.push(blockParagraph(block, words));
    }
  }
  closeBox();
  return content;
}

/** A section title in a grey band, like the PDF's card header. */
function sectionHeading(title: string, newPage = false): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    pageBreakBefore: newPage,
    spacing: { before: 280, after: 140 },
    shading: { type: ShadingType.CLEAR, fill: COLOR.band, color: 'auto' },
    border: {
      top: border(COLOR.border),
      bottom: border(COLOR.border),
      left: border(COLOR.border),
      right: border(COLOR.border),
    },
    indent: { left: 80, right: 80 },
    children: [
      run(printableText(title), {
        bold: true,
        size: SIZE.heading,
        color: COLOR.text,
      }),
    ],
  });
}

/** The cover's details: one row per fact section (label, value). */
function factsTable(
  facts: ReportSectionModel[],
  width: number,
  words: RegExp,
): Table {
  const labelWidth = Math.round(width * 0.3);
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [labelWidth, width - labelWidth],
    layout: TableLayoutType.FIXED,
    borders: {
      ...allBorders(COLOR.borderLight),
      insideHorizontal: border(COLOR.borderLight),
      insideVertical: NO_BORDER,
    },
    rows: facts.map(
      (fact) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: labelWidth, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              shading: {
                type: ShadingType.CLEAR,
                fill: 'FFFFFF',
                color: 'auto',
              },
              margins: { top: 80, bottom: 80, left: 140, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    run(printableText(fact.title), {
                      bold: true,
                      size: SIZE.small,
                      color: COLOR.muted,
                      allCaps: true,
                      characterSpacing: 10,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: width - labelWidth, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              shading: {
                type: ShadingType.CLEAR,
                fill: 'FFFFFF',
                color: 'auto',
              },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: runs(
                    fact.blocks.map((block) => block.text).join(' ') || '—',
                    {
                      color: COLOR.text,
                      noProof: fact.blocks.some((block) => block.noProof),
                    },
                    words,
                  ),
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

/** Highlights as shaded labels, like the badges on the PDF cover. */
function highlightsParagraph(highlights: string[]): Paragraph {
  const children: TextRun[] = [];
  highlights.forEach((text, index) => {
    if (index > 0) children.push(run('   ', { size: SIZE.citation }));
    children.push(
      new TextRun({
        text: ` ${printableText(text)} `,
        font: FONT,
        size: SIZE.citation,
        color: COLOR.text,
        shading: {
          type: ShadingType.CLEAR,
          fill: index === 0 ? COLOR.badge : 'FFFFFF',
          color: 'auto',
        },
        border: { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
        // Counts and labels, not prose.
        noProof: true,
      }),
    );
  });
  return new Paragraph({ spacing: { before: 200 }, children });
}

/** The cover: a tinted box with the title, details, summary, and counts. */
function cover(
  model: ReportDocumentModel,
  words: RegExp,
  summary?: ReportSectionModel,
): Table {
  const innerWidth = CONTENT_WIDTH - 2 * 360;
  const facts = model.sections.filter(
    (section) => section.placement === 'cover-fact',
  );
  const name = model.metadata?.expertName?.trim();
  const subline = [model.metadata?.specialty, model.metadata?.city]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ');
  const children: Block[] = [
    new Paragraph({
      children: [
        run(model.title.toUpperCase(), {
          bold: true,
          size: SIZE.small,
          color: COLOR.primary,
          characterSpacing: 30,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 60 },
      children: [
        run(
          `Generated ${formatGeneratedAt(model.generatedAt)} · Report ${model.metadata?.reportVersion ?? model.templateVersion}`,
          { size: SIZE.citation, color: COLOR.muted },
        ),
      ],
    }),
  ];
  if (name) {
    children.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [
          run(printableText(name), {
            bold: true,
            size: SIZE.coverName,
            color: COLOR.text,
          }),
        ],
      }),
    );
    if (subline) {
      children.push(
        new Paragraph({
          children: [
            run(subline, { size: SIZE.subheading, color: COLOR.muted }),
          ],
        }),
      );
    }
  }
  if (facts.length > 0) {
    children.push(
      new Paragraph({ spacing: { before: 200 }, children: [] }),
      factsTable(facts, innerWidth, words),
    );
  }
  const summaryLines = (summary?.blocks ?? [])
    .map((block) => block.text.trim())
    .filter(Boolean);
  if (summary && summaryLines.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 100 },
        children: [
          new TextRun({
            text: ` ${printableText(summary.title)} `,
            font: FONT,
            bold: true,
            size: SIZE.citation,
            color: 'F0FDFA',
            shading: {
              type: ShadingType.CLEAR,
              fill: COLOR.primary,
              color: 'auto',
            },
          }),
        ],
      }),
      ...summaryLines.map(
        (line) =>
          new Paragraph({
            spacing: { after: 100, line: 300 },
            children: runs(line, { size: 23, color: COLOR.text }, words),
          }),
      ),
    );
  }
  const highlights = (model.highlights ?? []).filter((item) => item.trim());
  if (highlights.length > 0) children.push(highlightsParagraph(highlights));
  children.push(new Paragraph({ children: [] }));

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: {
      ...allBorders(COLOR.coverBorder, 8),
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: {
              type: ShadingType.CLEAR,
              fill: COLOR.coverFill,
              color: 'auto',
            },
            margins: { top: 300, bottom: 120, left: 360, right: 360 },
            children,
          }),
        ],
      }),
    ],
  });
}

function contents(): Array<Paragraph | TableOfContents> {
  return [
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        run('Contents', { bold: true, size: SIZE.heading, color: COLOR.text }),
      ],
    }),
    // A block of its own: Word reads it as the contents field, and offers
    // to fill it in when the file is opened (features.updateFields).
    new TableOfContents('Contents', {
      hyperlink: true,
      headingStyleRange: '1-1',
    }),
  ];
}

/**
 * Shared Word renderer. Product modules supply the section tree; this class
 * does not know MCA or EWI templates. It follows the PDF report's layout:
 * a cover box, a contents list, one titled section per card with records in
 * boxes, and the disclaimer.
 */
@Injectable()
export class DocxReportRenderer {
  async render(
    model: ReportDocumentModel,
  ): Promise<ReportArtifact & { buffer: Buffer }> {
    const summary = model.sections.find(
      (section) => section.placement === 'cover-summary',
    );
    const words = technicalWords(model.noProofTerms);
    const children: Array<Block | TableOfContents> = [
      cover(model, words, summary),
      gap(12),
    ];
    if (model.includeTableOfContents) {
      children.push(...contents());
    }
    // After the contents, the sections start on a new page.
    let newPage = Boolean(model.includeTableOfContents);
    for (const section of model.sections) {
      const placement = section.placement ?? 'card';
      if (placement !== 'card') continue;
      children.push(sectionHeading(section.title, newPage));
      children.push(...sectionContent(section.blocks, words));
      newPage = false;
    }
    const disclaimer = model.metadata?.disclaimer?.trim();
    if (disclaimer) {
      children.push(
        sectionHeading('Disclaimer'),
        blockParagraph({ text: disclaimer, style: 'note' }, words),
      );
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360 },
        border: { top: { ...border(COLOR.border), space: 8 } },
        children: runs(
          [
            model.headerLabel,
            `Report generated ${formatGeneratedAt(model.generatedAt)}`,
            `${model.templateId} ${model.templateVersion}`,
          ].join(' · '),
          { size: SIZE.small, color: COLOR.muted },
          words,
        ),
      }),
    );

    const headerText = [model.headerLabel, model.metadata?.expertName]
      .filter(Boolean)
      .join(' · ');
    const document = new Document({
      title: [model.title, model.metadata?.expertName]
        .filter(Boolean)
        .join(' — '),
      description: `${model.templateId} ${model.templateVersion}`,
      creator: model.headerLabel,
      keywords: [
        model.product,
        model.templateId,
        model.metadata?.expertName,
        model.metadata?.specialty,
      ]
        .filter(Boolean)
        .join(', '),
      features: { updateFields: Boolean(model.includeTableOfContents) },
      styles: {
        default: {
          document: {
            run: {
              font: FONT,
              size: SIZE.body,
              color: COLOR.body,
              language: { value: 'en-US' },
            },
          },
          heading1: {
            run: {
              font: FONT,
              size: SIZE.heading,
              bold: true,
              color: COLOR.text,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: PAGE_MARGIN,
                bottom: PAGE_MARGIN,
                left: PAGE_MARGIN,
                right: PAGE_MARGIN,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: {
                    bottom: { ...border(COLOR.borderLight), space: 4 },
                  },
                  children: [
                    run(printableText(headerText), {
                      size: SIZE.small,
                      color: COLOR.faint,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      children: [
                        'Page ',
                        PageNumber.CURRENT,
                        ' of ',
                        PageNumber.TOTAL_PAGES,
                      ],
                      font: FONT,
                      size: SIZE.small,
                      color: COLOR.faint,
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = Buffer.from(await Packer.toBuffer(document));
    return {
      fileName: `${model.fileName.replace(/\.[a-z0-9]+$/i, '')}.docx`,
      mimeType: DOCX_MIME_TYPE,
      format: 'docx',
      templateId: model.templateId,
      templateVersion: model.templateVersion,
      buffer,
    };
  }
}
