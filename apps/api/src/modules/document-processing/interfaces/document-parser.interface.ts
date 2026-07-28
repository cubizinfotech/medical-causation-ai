import type { ParserType } from '../constants';
import type { ProcessedPage, ProcessedSection } from '../types';

/**
 * Input passed to every document parser.
 */
export interface ParserInput {
  filePath: string;
  buffer: Buffer;
  filename: string;
  extension: string;
  fileSize: number;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Raw output from a document parser before normalization.
 */
export interface ParserOutput {
  parserType: ParserType;
  pages: ProcessedPage[];
  sections: ProcessedSection[];
  rawText: string;
  pageCount: number;
  author?: string;
  title?: string;
  warnings: string[];
  /** PDF-specific: likely scanned, needs OCR */
  needsOcr?: boolean;
}

/**
 * Contract that every document parser must implement.
 */
export interface IDocumentParser {
  readonly parserType: ParserType;
  readonly supportedExtensions: readonly string[];

  canParse(extension: string): boolean;
  parse(input: ParserInput): Promise<ParserOutput>;
}
