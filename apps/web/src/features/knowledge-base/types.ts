import type { DocumentStatus, KnowledgeBaseFolder, KnowledgeCategory } from "./constants";

/**
 * Knowledge base document metadata (mirrors backend model).
 */
export interface KnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  extension: string;
  category: KnowledgeCategory;
  subCategory: string | null;
  folder: KnowledgeBaseFolder;
  size: number;
  status: DocumentStatus;
  checksum: string;
  createdAt: string;
  modifiedAt: string;
  discoveredAt: string;
}

export interface DocumentListOptions {
  folder?: KnowledgeBaseFolder;
  category?: KnowledgeCategory;
  status?: DocumentStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentListResult {
  documents: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Dashboard statistics for the Knowledge Base UI (future).
 */
export interface KnowledgeBaseDashboardStats {
  totalFiles: number;
  indexedFiles: number;
  pendingFiles: number;
  processingFiles: number;
  failedFiles: number;
  ignoredFiles: number;
  totalSizeBytes: number;
  lastScannedAt: string | null;
}

export interface KnowledgeBaseSectionSummary {
  key: KnowledgeBaseFolder;
  label: string;
  count: number;
  pendingCount: number;
  indexedCount: number;
}

/**
 * Full dashboard model for future Knowledge Base page.
 */
export interface KnowledgeBaseDashboard {
  title: string;
  stats: KnowledgeBaseDashboardStats;
  sections: KnowledgeBaseSectionSummary[];
}
