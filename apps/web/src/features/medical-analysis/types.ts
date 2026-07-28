/**
 * Frontend types aligned with backend MedicalAnalysisResult.
 */
export type EvidenceClassificationType =
  | "supporting"
  | "opposing"
  | "neutral"
  | "unknown";

export type PublicSourceName =
  | "PubMed"
  | "PubMed Central"
  | "NIH"
  | "ClinicalTrials.gov"
  | "Semantic Scholar"
  | "Crossref"
  | "WHO"
  | "CDC";

export interface AnalysisCitation {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  chunkNumber: number;
  similarityScore: number;
  citationText: string;
  sourceFile: string;
}

export interface PublicReference {
  id: string;
  title: string;
  source: PublicSourceName;
  url: string;
  year?: number;
  excerpt?: string;
}

export interface PrivateReference {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  citationText: string;
  sourceFile: string;
  sourceType: "private_kb";
}

export interface TimelineEvent {
  date: string;
  event: string;
  significance: string;
}

export interface RiskFactor {
  factor: string;
  category: "pre-existing" | "lifestyle" | "comorbidity" | "other";
  impact: string;
}

export interface CrossExamQuestion {
  question: string;
  purpose: string;
}

export interface CrossExamCategory {
  name: string;
  questions: CrossExamQuestion[];
}

export interface ResearchSourcesSummary {
  private: Array<{ name: string; description: string; count: number }>;
  public: Array<{
    name: string;
    description: string;
    status: "simulated" | "live";
  }>;
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
  causationOpinion: string;
  timelineEvents: TimelineEvent[];
  riskFactors: RiskFactor[];
  publicReferences: PublicReference[];
  privateReferences: PrivateReference[];
  crossExamination: CrossExamCategory[];
  researchSources: ResearchSourcesSummary;
  legalDisclaimer: string;
  metadata: {
    retrievalExecutionTimeMs: number;
    analysisExecutionTimeMs: number;
    llmProvider: string;
    llmModel: string;
    chunkCount: number;
    generatedAt: string;
    publicReferenceCount?: number;
    privateReferenceCount?: number;
    crossExamQuestionCount?: number;
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

export const TERMS_ACKNOWLEDGMENT =
  "I understand that this software is intended for informational and legal research purposes only and does not constitute medical advice.";
