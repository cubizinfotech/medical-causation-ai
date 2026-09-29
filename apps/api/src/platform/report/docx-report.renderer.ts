import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TableOfContents,
  TextRun,
} from 'docx';
import type { ReportArtifact } from './report.types';
import type { ReportBlock, ReportDocumentModel } from './report-document';

const NAVY = '1F4E79';

/**
 * Shared Word renderer. Product modules supply the section tree.
 * This class does not know MCA or EWI templates.
 */
@Injectable()
export class DocxReportRenderer {
  async render(
    model: ReportDocumentModel,
  ): Promise<ReportArtifact & { buffer: Buffer }> {
    const children: Paragraph[] = [
      paragraph({ text: model.title, style: 'title' }),
    ];
    if (model.subtitle) {
      children.push(paragraph({ text: model.subtitle, style: 'subtitle' }));
    }

    const meta = model.metadata;
    if (meta) {
      const metaLines = [
        meta.expertName ? `Expert: ${meta.expertName}` : null,
        meta.city ? `City: ${meta.city}` : null,
        meta.specialty ? `Specialty: ${meta.specialty}` : null,
        meta.investigationDate
          ? `Investigation date: ${meta.investigationDate}`
          : null,
        `Generated: ${model.generatedAt}`,
        `Report version: ${meta.reportVersion ?? model.templateVersion}`,
        `Template: ${meta.templateId ?? model.templateId}`,
        meta.product ? `Product: ${meta.product}` : null,
      ].filter((line): line is string => Boolean(line));
      for (const line of metaLines) {
        children.push(paragraph({ text: line, style: 'note' }));
      }
      if (meta.disclaimer) {
        children.push(paragraph({ text: meta.disclaimer, style: 'note' }));
      }
    } else {
      children.push(
        paragraph({
          text: `Generated ${model.generatedAt} · Template ${model.templateId} ${model.templateVersion}`,
          style: 'note',
        }),
      );
    }

    if (model.includeTableOfContents) {
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: 'Table of Contents',
              bold: true,
              size: 28,
              font: 'Calibri',
              color: NAVY,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TableOfContents('Table of Contents', {
              hyperlink: true,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Open this document in Microsoft Word and update the table of contents field if entries are blank.',
              italics: true,
              size: 18,
              font: 'Calibri',
              color: '666666',
            }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      );
    }

    for (const section of model.sections) {
      children.push(paragraph({ text: section.title, style: 'heading' }));
      for (const block of section.blocks) {
        children.push(paragraph(block));
      }
    }

    const document = new Document({
      title: model.title,
      description: `${model.product} report ${model.templateVersion}`,
      creator: 'Expert Witness Investigation',
      keywords: [
        model.product,
        model.templateId,
        model.metadata?.expertName,
        model.metadata?.specialty,
      ]
        .filter(Boolean)
        .join(', '),
      features: {
        updateFields: true,
      },
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22 },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 864, bottom: 864, left: 864, right: 864 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: {
                    bottom: { color: NAVY, space: 4, style: 'single', size: 8 },
                  },
                  children: [
                    new TextRun({
                      text: model.headerLabel,
                      italics: true,
                      color: NAVY,
                      size: 18,
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: `  ·  ${model.templateVersion}`,
                      color: '666666',
                      size: 16,
                      font: 'Calibri',
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
                      text: `${model.templateId} ${model.templateVersion}  ·  Page `,
                      size: 16,
                      font: 'Calibri',
                      color: '666666',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 16,
                      font: 'Calibri',
                      color: '666666',
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
      fileName: model.fileName,
      mimeType: model.mimeType,
      format: 'docx',
      templateId: model.templateId,
      templateVersion: model.templateVersion,
      buffer,
    };
  }
}

function paragraph(block: ReportBlock): Paragraph {
  const style = block.style ?? 'body';
  if (block.link) {
    return new Paragraph({
      spacing: { after: 120 },
      children: [
        new ExternalHyperlink({
          link: block.link,
          children: [
            new TextRun({
              text: block.text,
              style: 'Hyperlink',
              size: 20,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  }

  return new Paragraph({
    heading:
      style === 'title'
        ? HeadingLevel.TITLE
        : style === 'heading'
          ? HeadingLevel.HEADING_1
          : style === 'subheading'
            ? HeadingLevel.HEADING_2
            : undefined,
    alignment:
      style === 'title' || style === 'subtitle'
        ? AlignmentType.CENTER
        : undefined,
    spacing: {
      before: style === 'heading' ? 280 : 0,
      after: style === 'note' ? 80 : 120,
    },
    children: [
      new TextRun({
        text: block.text,
        bold: style === 'subtitle' || style === 'subheading',
        italics: style === 'citation' || style === 'note',
        size:
          style === 'title'
            ? 36
            : style === 'subtitle'
              ? 28
              : style === 'note' || style === 'citation'
                ? 20
                : 22,
        font: 'Calibri',
        color: style === 'note' || style === 'citation' ? '555555' : '222222',
      }),
    ],
  });
}
