/**
 * Processed page from document extraction (PDF).
 */
export interface ProcessedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  charCount: number;
}

/**
 * Structured section from document extraction (DOCX, Markdown).
 */
export interface ProcessedSection {
  type: "heading" | "paragraph" | "table";
  content: string;
  level?: number;
  order: number;
}

/**
 * Metadata extracted during document processing.
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
  createdAt: string;
  modifiedAt: string;
  author?: string;
  language?: string;
  needsOcr: boolean;
}

/**
 * Full processed document result (mirrors backend).
 */
export interface ProcessedDocument {
  documentId: string;
  filePath: string;
  relativePath: string;
  parserType: string;
  metadata: ExtractedDocumentMetadata;
  pages: ProcessedPage[];
  sections: ProcessedSection[];
  normalizedText: string;
  processedAt: string;
  processingDurationMs: number;
  warnings: string[];
}

/**
 * Processing status for future UI pipeline view.
 */
export type DocumentProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_ocr";

export interface DocumentProcessingJob {
  documentId: string;
  status: DocumentProcessingStatus;
  parserType?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
