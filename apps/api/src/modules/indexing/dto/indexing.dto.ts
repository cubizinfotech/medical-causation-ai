export interface IndexDocumentResponseDto {
  documentId: string;
  knowledgeDocumentId: string;
  status: string;
  skipped: boolean;
  chunkCount: number;
  embeddingCount: number;
  processingDurationMs: number;
}
