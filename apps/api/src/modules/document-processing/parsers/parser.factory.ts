import { Injectable } from '@nestjs/common';
import type { IDocumentParser } from '../interfaces';
import { UnsupportedFileTypeException } from '../exceptions';
import { PdfParser } from './pdf.parser';
import { DocxParser } from './docx.parser';
import { TxtParser, MarkdownParser } from './plain-text.parser';

/**
 * Resolves the correct parser for a given file extension.
 */
@Injectable()
export class ParserFactory {
  private readonly parsers: IDocumentParser[];

  constructor() {
    this.parsers = [
      new PdfParser(),
      new DocxParser(),
      new TxtParser(),
      new MarkdownParser(),
    ];
  }

  getParser(extension: string): IDocumentParser {
    const normalized = extension.toLowerCase().replace(/^\./, '');
    const parser = this.parsers.find((p) => p.canParse(normalized));

    if (!parser) {
      throw new UnsupportedFileTypeException(normalized);
    }

    return parser;
  }

  getAllParsers(): IDocumentParser[] {
    return [...this.parsers];
  }

  getSupportedExtensions(): string[] {
    return this.parsers.flatMap((p) => [...p.supportedExtensions]);
  }
}
