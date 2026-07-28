/**
 * DTO for future document processing API responses.
 */
export interface ProcessedDocumentResponseDto {
  documentId: string;
  relativePath: string;
  parserType: string;
  metadata: {
    title: string;
    filename: string;
    pageCount: number;
    wordCount: number;
    estimatedTokens: number;
    needsOcr: boolean;
  };
  pageCount: number;
  sectionCount: number;
  processingDurationMs: number;
  warnings: string[];
}
