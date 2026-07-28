export interface RetrievalResponseDto {
  question: string;
  chunkCount: number;
  contextTokenEstimate: number;
  executionTimeMs: number;
  citations: Array<{
    documentName: string;
    pageNumber: number | null;
    chunkNumber: number;
    similarityScore: number;
    citationText: string;
  }>;
}
