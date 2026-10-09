import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { createWorker, OEM, type Worker } from 'tesseract.js';

export interface PdfOcrPage {
  pageNumber: number;
  /** Recognized text with whitespace collapsed, like the PDF text layer. */
  text: string;
  /** Tesseract's mean word confidence, 0–100. */
  confidence: number;
  error?: string;
}

export interface PdfOcrOptions {
  /** Render resolution. 200 dpi reads typical record print well. */
  dpi?: number;
  onPage?: (done: number, total: number) => Promise<void> | void;
}

/** Keeps very large pages (posters, legal sheets at high dpi) in memory bounds. */
const MAX_SIDE_PX = 3400;

/** English model shipped with the app (no download at runtime). */
const LANG_PATH = join(
  dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0_best_int',
);

const STANDARD_FONTS = `${join(
  dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
)}/`;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocument = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
type CreateCanvas = (typeof import('@napi-rs/canvas'))['createCanvas'];

/**
 * Reads scanned PDF pages on this server. Each page is rendered to an image
 * (pdf.js with @napi-rs/canvas) and recognized with Tesseract. Nothing is
 * sent to another service. Pages are read one at a time; a page that fails
 * comes back empty with an error instead of stopping the others.
 */
@Injectable()
export class PdfPageOcr {
  async recognize(
    pdf: Buffer,
    pageNumbers: number[],
    options: PdfOcrOptions = {},
  ): Promise<PdfOcrPage[]> {
    if (pageNumbers.length === 0) return [];
    const dpi = options.dpi && options.dpi > 0 ? options.dpi : 200;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');
    const document = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      disableFontFace: true,
      standardFontDataUrl: STANDARD_FONTS,
      verbosity: 0,
    }).promise;
    let worker: Worker | undefined;
    try {
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        langPath: LANG_PATH,
        gzip: true,
        cacheMethod: 'none',
      });
      const results: PdfOcrPage[] = [];
      for (const [index, pageNumber] of pageNumbers.entries()) {
        results.push(
          await this.readPage(document, worker, createCanvas, pageNumber, dpi),
        );
        await options.onPage?.(index + 1, pageNumbers.length);
      }
      return results;
    } finally {
      await worker?.terminate();
      await document.destroy();
    }
  }

  private async readPage(
    document: PdfDocument,
    worker: Worker,
    createCanvas: CreateCanvas,
    pageNumber: number,
    dpi: number,
  ): Promise<PdfOcrPage> {
    try {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      let scale = dpi / 72;
      const longest = Math.max(base.width, base.height) * scale;
      if (longest > MAX_SIDE_PX) scale *= MAX_SIDE_PX / longest;
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext('2d');
      // Transparent areas would read as black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: context as never,
        canvas: canvas as never,
        viewport,
      }).promise;
      const image = await canvas.encode('png');
      page.cleanup();
      const { data } = await worker.recognize(image);
      return {
        pageNumber,
        text: data.text.replace(/\s+/g, ' ').trim(),
        confidence: Math.round(data.confidence),
      };
    } catch (error) {
      return {
        pageNumber,
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
