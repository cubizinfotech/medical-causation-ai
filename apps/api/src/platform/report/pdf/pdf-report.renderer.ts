import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ReportArtifact } from '../report.types';
import type { ReportDocumentModel } from '../report-document';
import { type PaintOp, type TextMeasurer } from './pdf-layout';
import { layoutReport } from './pdf-report-layout';
import { truncateText } from './pdf-text';
import {
  COLOR,
  CONTENT_WIDTH,
  PAGE,
  TEXT,
  type FontKey,
  type TextStyle,
} from './pdf-theme';
import { REPORT_ICONS } from './report-icons';

type Pdf = PDFKit.PDFDocument;

/**
 * Liberation Sans (SIL Open Font License) covers Latin, Greek, and Cyrillic
 * text. It ships with pdfjs-dist, which the API already uses to read PDFs.
 */
const FONT_FILES: Record<FontKey, string> = {
  regular: 'LiberationSans-Regular.ttf',
  bold: 'LiberationSans-Bold.ttf',
  italic: 'LiberationSans-Italic.ttf',
  boldItalic: 'LiberationSans-BoldItalic.ttf',
};

/** PDF standard fonts: no file needed, but Western European text only. */
const STANDARD_FONTS: Record<FontKey, string> = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
};

function findFontDirectory(): string | null {
  try {
    const directory = join(
      dirname(require.resolve('pdfjs-dist/package.json')),
      'standard_fonts',
    );
    return Object.values(FONT_FILES).every((file) =>
      existsSync(join(directory, file)),
    )
      ? directory
      : null;
  } catch {
    return null;
  }
}

/** Running footer, under the content area of every page. */
const FOOTER_RULE_Y = PAGE.height - 38;
const FOOTER_TEXT_TOP = PAGE.height - 33;

/**
 * Shared PDF renderer. Product modules supply the section tree; this class
 * does not know MCA or EWI templates. The output is text, not an image, so
 * it can be searched and copied, and its links and contents entries work.
 */
@Injectable()
export class PdfReportRenderer {
  private readonly logger = new Logger(PdfReportRenderer.name);
  private readonly fontDirectory = findFontDirectory();

  constructor() {
    if (!this.fontDirectory) {
      this.logger.warn(
        'Liberation Sans was not found in pdfjs-dist; PDF reports use Helvetica, which cannot print some non-Western characters.',
      );
    }
  }

  async render(
    model: ReportDocumentModel,
  ): Promise<ReportArtifact & { buffer: Buffer }> {
    const generatedAt = new Date(model.generatedAt);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      displayTitle: true,
      lang: 'en-US',
      info: {
        Title: [model.title, model.metadata?.expertName]
          .filter(Boolean)
          .join(' — '),
        Author: model.headerLabel,
        Subject: `${model.templateId} ${model.templateVersion}`,
        Keywords: [
          model.product,
          model.templateId,
          model.metadata?.expertName,
          model.metadata?.specialty,
        ]
          .filter(Boolean)
          .join(', '),
        ...(Number.isNaN(generatedAt.getTime())
          ? {}
          : { CreationDate: generatedAt, ModDate: generatedAt }),
      },
    });
    const output = collect(doc);
    const fonts = this.registerFonts(doc);
    const layout = layoutReport(model, measurerFor(doc, fonts));

    const footerLabel = [model.headerLabel, model.metadata?.expertName]
      .filter(Boolean)
      .join(' · ');
    layout.pages.forEach((ops, index) => {
      doc.addPage({ size: 'A4', margin: 0 });
      // Stable sort: within a layer, ops keep the order they were placed.
      for (const op of [...ops].sort((a, b) => a.layer - b.layer)) {
        paint(doc, op, fonts);
      }
      paintFooter(doc, fonts, footerLabel, index + 1, layout.pages.length);
    });
    doc.end();

    return {
      fileName: `${model.fileName.replace(/\.[a-z0-9]+$/i, '')}.pdf`,
      mimeType: 'application/pdf',
      format: 'pdf',
      templateId: model.templateId,
      templateVersion: model.templateVersion,
      buffer: await output,
    };
  }

  /** Font names to use in `doc.font()`, by weight and style. */
  private registerFonts(doc: Pdf): Record<FontKey, string> {
    if (!this.fontDirectory) return STANDARD_FONTS;
    const directory = this.fontDirectory;
    const names = {} as Record<FontKey, string>;
    for (const [key, file] of Object.entries(FONT_FILES) as Array<
      [FontKey, string]
    >) {
      names[key] = `report-${key}`;
      doc.registerFont(names[key], join(directory, file));
    }
    return names;
  }
}

function collect(doc: Pdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function measurerFor(doc: Pdf, fonts: Record<FontKey, string>): TextMeasurer {
  const widths = new Map<string, number>();
  const heights = new Map<string, number>();
  const use = (style: TextStyle) =>
    doc.font(fonts[style.font]).fontSize(style.size);
  return {
    width(text, style) {
      const key = `${style.font}|${style.size}|${style.characterSpacing ?? 0}|${text}`;
      let width = widths.get(key);
      if (width === undefined) {
        width = use(style).widthOfString(text, {
          characterSpacing: style.characterSpacing ?? 0,
        });
        widths.set(key, width);
      }
      return width;
    },
    glyphHeight(style) {
      const key = `${style.font}|${style.size}`;
      let height = heights.get(key);
      if (height === undefined) {
        height = use(style).currentLineHeight(false);
        heights.set(key, height);
      }
      return height;
    },
  };
}

function paint(doc: Pdf, op: PaintOp, fonts: Record<FontKey, string>): void {
  switch (op.kind) {
    case 'shape': {
      const { x, y, w, h } = op.frame;
      if (h <= 0 || w <= 0) return;
      doc.roundedRect(x, y, w, h, Math.min(op.radius, h / 2, w / 2));
      if (op.fill && op.stroke) {
        doc.lineWidth(0.75).fillAndStroke(op.fill, op.stroke);
      } else if (op.fill) {
        doc.fill(op.fill);
      } else if (op.stroke) {
        doc.lineWidth(0.75).stroke(op.stroke);
      }
      return;
    }
    case 'band': {
      if (op.clip.h <= 0) return;
      doc.save();
      doc
        .roundedRect(op.clip.x, op.clip.y, op.clip.w, op.clip.h, op.radius)
        .clip();
      doc.rect(op.frame.x, op.frame.y, op.frame.w, op.frame.h).fill(op.fill);
      doc.restore();
      return;
    }
    case 'text': {
      if (!op.text) return;
      doc
        .font(fonts[op.style.font])
        .fontSize(op.style.size)
        .fillColor(op.style.color);
      doc.text(op.text, op.x, op.y, {
        lineBreak: false,
        characterSpacing: op.style.characterSpacing ?? 0,
        ...(op.link
          ? { link: op.link, underline: op.style.underline === true }
          : {}),
        ...(op.goTo ? { goTo: op.goTo } : {}),
      });
      return;
    }
    case 'icon': {
      doc.save();
      doc.translate(op.x, op.y).scale(op.size / 24);
      for (const path of REPORT_ICONS[op.name]) doc.path(path);
      doc.lineWidth(2).lineCap('round').lineJoin('round').stroke(op.color);
      doc.restore();
      return;
    }
    case 'rule': {
      doc.save();
      doc.moveTo(op.x, op.y).lineTo(op.x + op.w, op.y);
      if (op.dotted) doc.dash(0.8, { space: 2.2 });
      doc.lineWidth(op.dotted ? 0.8 : 0.75).stroke(op.color);
      doc.restore();
      return;
    }
    case 'anchor': {
      doc.addNamedDestination(op.name, 'XYZ', 0, op.y, 0);
      if (op.outline) doc.outline.addItem(op.outline);
      return;
    }
  }
}

function paintFooter(
  doc: Pdf,
  fonts: Record<FontKey, string>,
  label: string,
  page: number,
  pages: number,
): void {
  const style = TEXT.footer;
  doc.save();
  doc
    .moveTo(PAGE.marginX, FOOTER_RULE_Y)
    .lineTo(PAGE.marginX + CONTENT_WIDTH, FOOTER_RULE_Y)
    .lineWidth(0.5)
    .stroke(COLOR.borderLight);
  doc.restore();
  doc.font(fonts[style.font]).fontSize(style.size).fillColor(style.color);
  const pageText = `Page ${page} of ${pages}`;
  const pageWidth = doc.widthOfString(pageText);
  const labelText = truncateText(
    label,
    CONTENT_WIDTH - pageWidth - 24,
    (text) => doc.widthOfString(text),
  );
  doc.text(labelText, PAGE.marginX, FOOTER_TEXT_TOP, { lineBreak: false });
  doc.text(
    pageText,
    PAGE.marginX + CONTENT_WIDTH - pageWidth,
    FOOTER_TEXT_TOP,
    { lineBreak: false },
  );
}
