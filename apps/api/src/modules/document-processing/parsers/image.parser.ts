import { PARSER_TYPES } from '../constants';
import type { IDocumentParser, ParserInput, ParserOutput } from '../interfaces';
import { ParsingFailedException } from '../exceptions';

/**
 * Image parser for PNG/JPEG/TIFF.
 * Pixel OCR is delegated to OcrService after parse (needsOcr=true).
 * Does not invent text content.
 */
export class ImageParser implements IDocumentParser {
  readonly parserType = PARSER_TYPES.IMAGE;
  readonly supportedExtensions = [
    'png',
    'jpg',
    'jpeg',
    'tif',
    'tiff',
    'webp',
  ] as const;

  canParse(extension: string): boolean {
    return (this.supportedExtensions as readonly string[]).includes(
      extension.toLowerCase(),
    );
  }

  parse(input: ParserInput): Promise<ParserOutput> {
    if (!input.buffer?.length) {
      return Promise.reject(
        new ParsingFailedException(input.filename, 'Empty image buffer'),
      );
    }

    return Promise.resolve({
      parserType: this.parserType,
      pages: [
        {
          pageNumber: 1,
          text: '',
          wordCount: 0,
          charCount: 0,
          ocrStatus: 'required',
        },
      ],
      sections: [],
      rawText: '',
      pageCount: 1,
      warnings: [
        'Image document requires OCR. Text will be extracted by the configured OCR provider.',
      ],
      needsOcr: true,
    });
  }
}
