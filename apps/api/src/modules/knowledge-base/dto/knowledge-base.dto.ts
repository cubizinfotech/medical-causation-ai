/**
 * DTOs for future knowledge base API endpoints.
 * Not wired to HTTP controllers in this phase.
 */
export interface DiscoverDocumentsResponseDto {
  count: number;
  scannedAt: string;
}

export interface DocumentResponseDto {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  extension: string;
  category: string;
  subCategory: string | null;
  folder: string;
  size: number;
  status: string;
  checksum: string;
  createdAt: string;
  modifiedAt: string;
  discoveredAt: string;
}

export interface KnowledgeBaseStatsResponseDto {
  totalFiles: number;
  indexedFiles: number;
  pendingFiles: number;
  processingFiles: number;
  failedFiles: number;
  ignoredFiles: number;
  totalSizeBytes: number;
  lastScannedAt: string | null;
  sections: Array<{
    key: string;
    label: string;
    count: number;
    pendingCount: number;
    indexedCount: number;
  }>;
}
