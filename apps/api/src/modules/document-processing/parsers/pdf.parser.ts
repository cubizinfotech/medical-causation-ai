import { PARSER_TYPES } from '../constants';
import type { IDocumentParser, ParserInput, ParserOutput } from '../interfaces';
import {
  DocumentCorruptedException,
  ParsingFailedException,
  TooManyPagesException,
} from '../exceptions';
import type { ProcessedPage } from '../types';
import { CONTROL_CHARACTERS, countWords } from '../utils';

/** Pages with less text than this are checked for images (likely scans). */
const IMAGE_CHECK_MAX_CHARS = 300;

/**
 * Extract text page-by-page from PDF files using pdfjs-dist.
 * Handles large medical books by processing one page at a time.
 */
export class PdfParser implements IDocumentParser {
  readonly parserType = PARSER_TYPES.PDF;
  readonly supportedExtensions = ['pdf'] as const;

  canParse(extension: string): boolean {
    return extension.toLowerCase() === 'pdf';
  }

  async parse(input: ParserInput): Promise<ParserOutput> {
    const warnings: string[] = [];
    let pdf: { destroy(): Promise<void> } | undefined;

    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const data = new Uint8Array(input.buffer);

      const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
      });

      const document = await loadingTask.promise;
      pdf = document;
      const pageCount = document.numPages;
      if (input.maxPages !== undefined && pageCount > input.maxPages) {
        throw new TooManyPagesException(
          input.filename,
          pageCount,
          input.maxPages,
        );
      }
      const pages: ProcessedPage[] = [];

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await document.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) => {
            if ('str' in item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ')
          // Some PDFs encode NUL and other control characters in their text;
          // PostgreSQL rejects NUL in text columns.
          .replace(CONTROL_CHARACTERS, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        let hasImages: boolean | undefined;
        if (pageText.length < IMAGE_CHECK_MAX_CHARS) {
          const operators = await page.getOperatorList();
          hasImages = operators.fnArray.some(
            (op) =>
              op === pdfjs.OPS.paintImageXObject ||
              op === pdfjs.OPS.paintInlineImageXObject ||
              op === pdfjs.OPS.paintImageXObjectRepeat ||
              op === pdfjs.OPS.paintImageMaskXObject,
          );
        }

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          wordCount: countWords(pageText),
          charCount: pageText.length,
          ...(hasImages !== undefined ? { hasImages } : {}),
        });
      }

      const rawText = pages.map((p) => p.text).join('\n\n');
      const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
      const avgCharsPerPage = pageCount > 0 ? totalChars / pageCount : 0;

      let needsOcr = false;
      if (totalChars < 50) {
        needsOcr = true;
        warnings.push(
          'PDF contains very little extractable text — likely scanned. OCR is required.',
        );
      } else if (avgCharsPerPage < 20 && pageCount > 1) {
        needsOcr = true;
        warnings.push(
          'Low text density per page — document may contain scanned pages. OCR will be attempted.',
        );
      }

      let author: string | undefined;
      let title: string | undefined;
      try {
        const meta = await document.getMetadata();
        const info = meta?.info as Record<string, string> | undefined;
        if (info) {
          author = info.Author ?? info.Creator;
          title = info.Title;
        }
      } catch {
        warnings.push('Could not extract PDF document info metadata.');
      }

      return {
        parserType: this.parserType,
        pages,
        sections: [],
        rawText,
        pageCount,
        author,
        title: title || undefined,
        warnings,
        needsOcr,
      };
    } catch (error) {
      if (error instanceof TooManyPagesException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Invalid PDF')) {
        throw new DocumentCorruptedException(input.filename, message);
      }
      throw new ParsingFailedException(input.filename, message);
    } finally {
      // pdf.js keeps the whole document in memory until destroyed.
      await pdf?.destroy().catch(() => undefined);
    }
  }
}
