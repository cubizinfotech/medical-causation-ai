/**
 * Frontend types aligned with backend MedicalAnalysisResult.
 */
export type EvidenceClassificationType =
  | "supporting"
  | "opposing"
  | "neutral"
  | "unknown";

export interface AnalysisCitation {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  chunkNumber: number;
  similarityScore: number;
  citationText: string;
  sourceFile: string;
}

export interface RetrievedEvidenceItem {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  chunkNumber: number;
  excerpt: string;
  similarityScore: number;
  classification: EvidenceClassificationType;
  classificationReasoning: string;
  citation: AnalysisCitation;
}

export interface ClassifiedEvidence {
  type: EvidenceClassificationType;
  reasoning: string;
  excerpt: string;
  citation: AnalysisCitation;
}

export interface ConfidenceScore {
  score: number;
  explanation: string;
  disclaimer: string;
}

export interface MedicalAnalysisResult {
  executiveSummary: string;
  patientSummary: string;
  medicalQuestion: string;
  retrievedEvidence: RetrievedEvidenceItem[];
  supportingEvidence: ClassifiedEvidence[];
  opposingEvidence: ClassifiedEvidence[];
  neutralEvidence: ClassifiedEvidence[];
  aiReasoning: string;
  confidenceScore: ConfidenceScore;
  limitations: string[];
  conclusion: string;
  citations: AnalysisCitation[];
  metadata: {
    retrievalExecutionTimeMs: number;
    analysisExecutionTimeMs: number;
    llmProvider: string;
    llmModel: string;
    chunkCount: number;
    generatedAt: string;
  };
}

export type AnalyzeCaseRequest = {
  patientName: string;
  patientAge: string;
  patientGender: string;
  accidentDate: string;
  accidentType: string;
  accidentDescription: string;
  diagnosis: string;
  symptoms: string;
  medicalHistory?: string;
  medications?: string;
  timeline?: string;
  medicalQuestion: string;
};
