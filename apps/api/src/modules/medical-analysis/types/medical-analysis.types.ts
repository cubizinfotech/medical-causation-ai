import type { EvidenceClassificationType } from '../constants';
import type { RetrievalFilters } from '@modules/rag/types';

export type PublicSourceName =
  | 'PubMed'
  | 'PubMed Central'
  | 'NIH'
  | 'ClinicalTrials.gov'
  | 'Semantic Scholar'
  | 'Crossref'
  | 'WHO'
  | 'CDC';

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
  sourceType: 'private_kb';
}

export interface TimelineEvent {
  date: string;
  event: string;
  significance: string;
}

export interface RiskFactor {
  factor: string;
  category: 'pre-existing' | 'lifestyle' | 'comorbidity' | 'other';
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
    status: 'simulated' | 'live';
  }>;
}

/**
 * Patient case input for medical analysis.
 */
export interface MedicalAnalysisRequest {
  medicalQuestion: string;
  patientInformation?: string;
  injury?: string;
  diagnosis?: string;
  symptoms?: string;
  medicalHistory?: string;
  accidentDate?: string;
  preExistingConditions?: string;
  filters?: RetrievalFilters;
  topK?: number;
}

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

/**
 * Structured JSON output from the LLM (extensible schema).
 */
export interface MedicalAnalysisLlmOutput {
  executiveSummary: string;
  patientSummary: string;
  medicalQuestion: string;
  retrievedEvidence: Array<{
    chunkId: string;
    excerpt: string;
    classification: EvidenceClassificationType;
    classificationReasoning: string;
  }>;
  supportingEvidence: Array<{
    chunkId: string;
    excerpt: string;
    reasoning: string;
  }>;
  opposingEvidence: Array<{
    chunkId: string;
    excerpt: string;
    reasoning: string;
  }>;
  neutralEvidence?: Array<{
    chunkId: string;
    excerpt: string;
    reasoning: string;
  }>;
  aiReasoning: string;
  confidenceScore: number;
  confidenceExplanation: string;
  limitations: string[];
  conclusion: string;
  citations: Array<{
    chunkId: string;
    statement: string;
  }>;
}

export interface BaseMedicalAnalysisResult {
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

export interface MedicalAnalysisResult extends BaseMedicalAnalysisResult {
  causationOpinion: string;
  timelineEvents: TimelineEvent[];
  riskFactors: RiskFactor[];
  publicReferences: PublicReference[];
  privateReferences: PrivateReference[];
  crossExamination: CrossExamCategory[];
  researchSources: ResearchSourcesSummary;
  legalDisclaimer: string;
  metadata: BaseMedicalAnalysisResult['metadata'] & {
    publicReferenceCount?: number;
    privateReferenceCount?: number;
    crossExamQuestionCount?: number;
  };
}

export interface BuiltAnalysisPrompts {
  systemPrompt: string;
  userPrompt: string;
  allowedChunkIds: string[];
  citationCatalog: AnalysisCitation[];
}
