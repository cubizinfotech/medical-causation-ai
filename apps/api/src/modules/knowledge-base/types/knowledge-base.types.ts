import type {
  DocumentStatus,
  KnowledgeBaseFolder,
  KnowledgeCategory,
} from '../constants';

/**
 * Core document metadata model.
 * Represents a discovered file in the knowledge base — not yet indexed in the database.
 */
export interface KnowledgeDocument {
  /** Stable identifier derived from relative path and checksum */
  id: string;
  /** Human-readable title derived from filename */
  title: string;
  /** Original filename with extension */
  filename: string;
  /** Absolute file path on disk */
  filePath: string;
  /** Path relative to knowledge base root */
  relativePath: string;
  /** File extension without dot (lowercase) */
  extension: string;
  /** Knowledge category classification */
  category: KnowledgeCategory;
  /** Sub-category derived from parent folder (e.g. topic folder within articles/) */
  subCategory: string | null;
  /** Top-level knowledge base folder */
  folder: KnowledgeBaseFolder;
  /** File size in bytes */
  size: number;
  /** File system creation time */
  createdAt: Date;
  /** File system last modified time */
  modifiedAt: Date;
  /** SHA-256 checksum of file contents */
  checksum: string;
  /** Indexing/processing status */
  status: DocumentStatus;
  /** When the document was last discovered by the scanner */
  discoveredAt: Date;
}

/**
 * Result of document validation.
 */
export interface DocumentValidationResult {
  valid: boolean;
  errors: DocumentValidationError[];
  warnings: DocumentValidationWarning[];
}

export interface DocumentValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface DocumentValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Options for listing and filtering documents.
 */
export interface DocumentListOptions {
  folder?: KnowledgeBaseFolder;
  category?: KnowledgeCategory;
  subCategory?: string;
  status?: DocumentStatus;
  extension?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated list of documents.
 */
export interface DocumentListResult {
  documents: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Result of a knowledge base refresh/discovery operation.
 */
export interface KnowledgeBaseRefreshResult {
  discovered: number;
  added: number;
  updated: number;
  removed: number;
  ignored: number;
  duplicates: number;
  scannedAt: Date;
  durationMs: number;
}

/**
 * Dashboard statistics for the knowledge base (future UI).
 */
export interface KnowledgeBaseStats {
  totalFiles: number;
  indexedFiles: number;
  pendingFiles: number;
  processingFiles: number;
  failedFiles: number;
  ignoredFiles: number;
  byFolder: Record<string, number>;
  byCategory: Record<string, number>;
  byExtension: Record<string, number>;
  totalSizeBytes: number;
  lastScannedAt: Date | null;
}

/**
 * Summary for a knowledge base dashboard section.
 */
export interface KnowledgeBaseSectionSummary {
  key: string;
  label: string;
  count: number;
  pendingCount: number;
  indexedCount: number;
}
