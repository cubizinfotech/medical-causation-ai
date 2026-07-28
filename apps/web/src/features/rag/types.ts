/**
 * Retrieved document summary for frontend display.
 */
export interface RetrievedDocument {
  documentId: string;
  knowledgeDocumentId: string;
  documentTitle: string;
  category: string;
  subCategory: string | null;
  sourceFile: string;
  chunkCount: number;
  maxSimilarityScore: number;
}

/**
 * Retrieved chunk with citation for frontend display.
 */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  pageNumber: number | null;
  chunkIndex: number;
  category: string;
  similarityScore: number;
  citation: Citation;
}

/**
 * Citation for reports and UI.
 */
export interface Citation {
  documentName: string;
  pageNumber: number | null;
  chunkNumber: number;
  category: string;
  similarityScore: number;
  citationText: string;
}

/**
 * Similarity score breakdown.
 */
export interface SimilarityScore {
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

/**
 * Full retrieval response for future UI.
 */
export interface RetrievalResponse {
  question: string;
  documents: RetrievedDocument[];
  chunks: RetrievedChunk[];
  contextText: string;
  contextTokenEstimate: number;
  executionTimeMs: number;
}
