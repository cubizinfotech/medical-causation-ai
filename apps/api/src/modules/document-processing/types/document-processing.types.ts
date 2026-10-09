import type { ParserType } from '../constants';

/**
 * OCR lifecycle for a processed document or page.
 * Failures are recorded; text is never invented.
 */
export type OcrStatus =
  'not_required' | 'required' | 'completed' | 'failed' | 'skipped';

/**
 * A single page of extracted text (PDF / OCR documents).
 * pageNumber is only set when the parser observed a real page.
 */
export interface ProcessedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  charCount: number;
  /** Bates numbers detected on this page only (never fabricated). */
  batesNumbers?: string[];
  ocrStatus?: OcrStatus;
  /**
   * Set for pages with little text: true when the page also paints an image,
   * as a scan with a fax or stamp text line does.
   */
  hasImages?: boolean;
}

/**
 * A structured content section (DOCX / TXT / Markdown).
 */
export interface ProcessedSection {
  type: 'heading' | 'paragraph' | 'table';
  content: string;
  /** Heading level 1–6 when type is heading */
  level?: number;
  order: number;
}

/**
 * Page reference preserved from parsing. Never invent page numbers.
 */
export interface PageReference {
  pageNumber: number;
  /** Optional label when the source provided one (e.g. cover). */
  label?: string;
  charCount: number;
  batesNumbers: string[];
}

/**
 * Extracted document metadata from parsing.
 */
export interface ExtractedDocumentMetadata {
  title: string;
  filename: string;
  extension: string;
  fileSize: number;
  pageCount: number;
  wordCount: number;
  charCount: number;
  estimatedTokens: number;
  createdAt: Date;
  modifiedAt: Date;
  author?: string;
  language?: string;
  /** True when PDF/image appears scanned — OCR required or attempted. */
  needsOcr: boolean;
  ocrStatus: OcrStatus;
  /** SHA-256 of file bytes when computed. */
  checksum?: string;
}

/**
 * Full result of document processing.
 */
export interface ProcessedDocumentResult {
  /** Knowledge base document ID (when processed from KnowledgeDocument) */
  documentId: string;
  filePath: string;
  relativePath: string;
  parserType: ParserType;
  metadata: ExtractedDocumentMetadata;
  /** Page-level content for PDF / image OCR documents */
  pages: ProcessedPage[];
  /** Structured sections for DOCX / TXT / Markdown */
  sections: ProcessedSection[];
  /** Raw concatenated text before normalization */
  rawText: string;
  /** Normalized full text ready for chunking / evidence linking */
  normalizedText: string;
  processedAt: Date;
  processingDurationMs: number;
  warnings: string[];
  /** Bates numbers detected across the document (never fabricated). */
  batesNumbers: string[];
  /** Page references preserved from parsing only. */
  pageReferences: PageReference[];
  /** True when OCR was attempted for this document. */
  ocrAttempted: boolean;
}

/**
 * Input for the document processing pipeline.
 */
export interface ProcessDocumentInput {
  /** Absolute path to the file */
  filePath: string;
  /** Optional knowledge base document ID */
  documentId?: string;
  /** Optional relative path within knowledge base */
  relativePath?: string;
  /** Optional source URL associated with this file (metadata only). */
  sourceUrl?: string;
  /** Provider or channel that supplied the file (e.g. lexisnexis, upload). */
  sourceProvider?: string;
  /** Access classification for storage policy. */
  access?: 'public' | 'restricted' | 'unavailable';
}

/**
 * Options for the processing pipeline.
 */
export interface ProcessDocumentOptions {
  /** Skip validation (use only in tests) */
  skipValidation?: boolean;
  /** Force OCR even when text density looks sufficient */
  forceOcr?: boolean;
  /** Skip OCR even when needsOcr is true */
  skipOcr?: boolean;
}
