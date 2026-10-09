import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DemandLetterContent, LetterTable } from './demand-letter.content';

const FONT = 'Calibri';
const BODY = 22;
const SMALL = 18;
const GREY = '666666';
const RULE = { style: BorderStyle.SINGLE, size: 6, color: '999999' };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function run(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    color?: string;
  } = {},
): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: options.size ?? BODY,
    bold: options.bold,
    italics: options.italics,
    color: options.color,
  });
}

function line(
  text: string,
  options: {
    bold?: boolean;
    after?: number;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    keepNext?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.align,
    keepNext: options.keepNext,
    spacing: { after: options.after ?? 0 },
    children: [
      run(text, {
        bold: options.bold,
        size: options.size,
        color: options.color,
      }),
    ],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: [run(text)],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [run(text, { bold: true })],
  });
}

function cell(
  text: string,
  options: {
    bold?: boolean;
    right?: boolean;
    shade?: boolean;
    topRule?: boolean;
  },
): TableCell {
  return new TableCell({
    shading: options.shade ? { fill: 'F2F2F2' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: {
      top: options.topRule ? RULE : NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
    },
    children: [
      new Paragraph({
        alignment: options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [run(text, { bold: options.bold })],
      }),
    ],
  });
}

function table(content: LetterTable): Table {
  const right = (index: number) => content.amountColumns.includes(index);
  const rows = [
    new TableRow({
      tableHeader: true,
      children: content.columns.map((column, index) =>
        cell(column, { bold: true, right: right(index), shade: true }),
      ),
    }),
    ...content.rows.map(
      (values) =>
        new TableRow({
          children: values.map((value, index) =>
            cell(value, { right: right(index) }),
          ),
        }),
    ),
    ...(content.totalRow
      ? [
          new TableRow({
            children: content.totalRow.map((value, index) =>
              cell(value, { bold: true, right: right(index), topRule: true }),
            ),
          }),
        ]
      : []),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: RULE,
      bottom: RULE,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows,
  });
}

/** The demand letter as a Word document the attorney edits and signs. */
export async function renderDemandLetter(
  content: DemandLetterContent,
): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  // Letterhead, with a rule under the last line.
  const head = [content.letterhead.firm, ...content.letterhead.lines];
  head.forEach((text, index) => {
    const last = index === head.length - 1;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: last ? { bottom: { ...RULE, space: 6 } } : undefined,
        spacing: { after: last ? 360 : 0 },
        children: [
          run(text, {
            bold: index === 0,
            size: index === 0 ? 28 : SMALL,
            color: index === 0 ? undefined : GREY,
          }),
        ],
      }),
    );
  });

  children.push(line(content.letterDate, { after: 240 }));
  children.push(
    line('CONFIDENTIAL SETTLEMENT COMMUNICATION', {
      bold: true,
      size: SMALL,
      after: 240,
    }),
  );
  content.recipient.forEach((text, index) =>
    children.push(
      line(text, { after: index === content.recipient.length - 1 ? 240 : 0 }),
    ),
  );

  content.re.forEach((entry, index) =>
    children.push(
      new Paragraph({
        indent: { left: 720, hanging: 720 },
        spacing: { after: index === content.re.length - 1 ? 240 : 0 },
        children: [
          run(index === 0 ? 'Re:\t' : '\t'),
          run(`${entry.label}: `, { bold: true }),
          run(entry.value),
        ],
      }),
    ),
  );

  children.push(line(content.salutation, { after: 160 }));
  content.intro.forEach((text) => children.push(body(text)));

  for (const section of content.sections) {
    children.push(heading(section.heading));
    section.paragraphs.forEach((text) => children.push(body(text)));
    if (section.table) {
      children.push(table(section.table));
      children.push(line('', { after: 120 }));
    }
    (section.after ?? []).forEach((text) => children.push(body(text)));
  }

  content.closing.forEach((text) => children.push(body(text)));
  children.push(line('Sincerely,', { after: 720, keepNext: true }));
  content.signature.forEach((text, index) =>
    children.push(
      line(text, { keepNext: index < content.signature.length - 1 }),
    ),
  );

  children.push(line('', { after: 240 }));
  children.push(line('Enclosures:', { bold: true, keepNext: true }));
  content.enclosures.forEach((text) => children.push(line(text)));

  const document = new Document({
    title: `Demand letter — ${content.re[0]?.value ?? ''}`,
    creator: 'Medical Causation AI',
    description: 'Draft settlement demand letter',
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  run(
                    'DRAFT — check every statement against the records before sending',
                    {
                      italics: true,
                      size: 16,
                      color: GREY,
                    },
                  ),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: GREY,
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
  return Buffer.from(await Packer.toBuffer(document));
}
