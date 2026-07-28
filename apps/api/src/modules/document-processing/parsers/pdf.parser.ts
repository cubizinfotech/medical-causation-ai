import { PARSER_TYPES } from '../constants';
import type { IDocumentParser, ParserInput, ParserOutput } from '../interfaces';
import {
  DocumentCorruptedException,
  ParsingFailedException,
} from '../exceptions';
import type { ProcessedPage } from '../types';
import { countWords } from '../utils';

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

    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const data = new Uint8Array(input.buffer);

      const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
      });

      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;
      const pages: ProcessedPage[] = [];

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) => {
            if ('str' in item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          wordCount: countWords(pageText),
          charCount: pageText.length,
        });
      }

      const rawText = pages.map((p) => p.text).join('\n\n');
      const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
      const avgCharsPerPage = pageCount > 0 ? totalChars / pageCount : 0;

      let needsOcr = false;
      if (totalChars < 50) {
        needsOcr = true;
        warnings.push(
          'PDF contains very little extractable text — likely scanned. OCR will be required in a future phase.',
        );
      } else if (avgCharsPerPage < 20 && pageCount > 1) {
        needsOcr = true;
        warnings.push(
          'Low text density per page — document may contain scanned pages. OCR fallback prepared.',
        );
      }

      let author: string | undefined;
      let title: string | undefined;
      try {
        const meta = await pdf.getMetadata();
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
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Invalid PDF')) {
        throw new DocumentCorruptedException(input.filename, message);
      }
      throw new ParsingFailedException(input.filename, message);
    }
  }
}
