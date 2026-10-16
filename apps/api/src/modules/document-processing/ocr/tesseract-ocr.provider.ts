import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OcrSettings } from '@config/ocr.config';
import { PdfPageOcr } from './pdf-page-ocr';
import type {
  IOcrProvider,
  OcrContext,
  OcrDocumentResult,
  OcrPageInput,
  OcrPageResult,
} from './ocr.types';

/** A page with less text than this is treated as scanned. */
const MIN_TEXT_CHARS = 50;
/** Pages Tesseract read below this confidence (0–100) are counted in a warning. */
const LOW_CONFIDENCE = 60;
const PROGRESS_EVERY = 25;

/**
 * Reads scanned pages of library PDFs with the same Tesseract engine used
 * for uploaded medical records. It runs on this server; nothing is sent
 * elsewhere. Pages that already have text are kept as they are, and a page
 * that cannot be read stays empty: no text is invented.
 */
@Injectable()
export class TesseractOcrProvider implements IOcrProvider {
  readonly name = 'tesseract';
  private readonly logger = new Logger(TesseractOcrProvider.name);

  constructor(
    private readonly pdfOcr: PdfPageOcr,
    private readonly configService: ConfigService,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async recognizePages(
    pages: OcrPageInput[],
    context: OcrContext = {},
  ): Promise<OcrDocumentResult> {
    const settings = this.configService.get<OcrSettings>('ocr');
    const maxPages = settings?.maxPages ?? 500;
    const unchanged = (
      status: OcrPageResult['status'],
      warning?: string,
    ): OcrPageResult[] =>
      pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.existingText,
        status,
        ...(warning ? { warning } : {}),
      }));
    const failed = (warning: string): OcrDocumentResult => ({
      providerName: this.name,
      status: 'failed',
      warnings: [warning],
      pages: unchanged('failed'),
    });

    const source = context.pdfPath || context.pdf;
    if (!source) {
      return failed(
        'OCR reads scanned PDF pages only; this file is not a PDF.',
      );
    }
    const scanned = pages
      .filter((page) => page.existingText.trim().length < MIN_TEXT_CHARS)
      .map((page) => page.pageNumber);
    if (scanned.length === 0) {
      return {
        providerName: this.name,
        status: 'completed',
        warnings: [],
        pages: unchanged('completed'),
      };
    }
    if (scanned.length > maxPages) {
      return failed(
        `${scanned.length} scanned pages is more than OCR_MAX_PAGES (${maxPages}). Split the file into smaller parts, or raise OCR_MAX_PAGES.`,
      );
    }

    const started = Date.now();
    this.logger.log(`Reading ${scanned.length} scanned page(s) with OCR`);
    const results = await this.pdfOcr.recognize(source, scanned, {
      dpi: settings?.dpi,
      onPage: (done, total) => {
        if (done % PROGRESS_EVERY === 0 && done < total) {
          this.logger.log(`OCR: ${done} of ${total} pages read`);
        }
      },
    });
    const byPage = new Map(
      results.map((result) => [result.pageNumber, result]),
    );

    let read = 0;
    let lowConfidence = 0;
    const pageResults: OcrPageResult[] = pages.map((page) => {
      const ocr = byPage.get(page.pageNumber);
      if (!ocr) {
        return {
          pageNumber: page.pageNumber,
          text: page.existingText,
          status: 'completed',
        };
      }
      if (!ocr.text) {
        return {
          pageNumber: page.pageNumber,
          text: page.existingText,
          status: 'failed',
          warning: ocr.error ?? 'OCR found no text on this page',
        };
      }
      read++;
      if (ocr.confidence < LOW_CONFIDENCE) lowConfidence++;
      return {
        pageNumber: page.pageNumber,
        text: ocr.text,
        status: 'completed',
      };
    });

    const warnings = [
      `${read} of ${scanned.length} scanned page(s) were read with OCR.`,
      ...(lowConfidence > 0
        ? [
            `${lowConfidence} page(s) were read with low confidence; passages from them may contain reading errors.`,
          ]
        : []),
    ];
    this.logger.log(
      `OCR finished: ${read} of ${scanned.length} page(s) read in ${Math.round((Date.now() - started) / 1000)}s`,
    );
    return {
      providerName: this.name,
      status:
        read > 0 || scanned.length < pages.length ? 'completed' : 'failed',
      warnings,
      pages: pageResults,
    };
  }
}
