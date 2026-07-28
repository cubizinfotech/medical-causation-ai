import type { ParserType } from '../constants';

/**
 * A single page of extracted text (PDF documents).
 */
export interface ProcessedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  charCount: number;
}

/**
 * A structured content section (DOCX documents).
 */
export interface ProcessedSection {
  type: 'heading' | 'paragraph' | 'table';
  content: string;
  /** Heading level 1–6 when type is heading */
  level?: number;
  order: number;
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
  /** True when PDF appears scanned — OCR required in a future phase */
  needsOcr: boolean;
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
  /** Page-level content for PDF documents */
  pages: ProcessedPage[];
  /** Structured sections for DOCX documents */
  sections: ProcessedSection[];
  /** Raw concatenated text before normalization */
  rawText: string;
  /** Normalized full text ready for future chunking */
  normalizedText: string;
  processedAt: Date;
  processingDurationMs: number;
  warnings: string[];
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
}

/**
 * Options for the processing pipeline.
 */
export interface ProcessDocumentOptions {
  /** Skip validation (use only in tests) */
  skipValidation?: boolean;
}
