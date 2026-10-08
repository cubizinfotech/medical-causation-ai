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
  /** Absent on older reports, which only cited the knowledge base. */
  sourceKind?: "knowledge_base" | "medical_record";
  /** Set for medical_record citations: the uploaded record to open. */
  recordId?: string;
}

export type ChronologyEventType =
  | "emergency"
  | "office_visit"
  | "hospital_admission"
  | "imaging"
  | "lab"
  | "procedure"
  | "surgery"
  | "therapy"
  | "medication"
  | "other";

export interface ChronologyEvent {
  /** Citation id, e.g. "rec-3". */
  id: string;
  /** YYYY-MM-DD, YYYY-MM or YYYY; empty when the record gives no date. */
  date: string;
  type: ChronologyEventType;
  provider?: string;
  facility?: string;
  summary: string;
  diagnoses: Array<{ description: string; icd10?: string }>;
  treatments: string[];
  medications: string[];
  recordId: string;
  documentName: string;
  pageNumber: number;
  batesNumbers: string[];
  quote: string;
  /** False when the quote could not be found on the cited page. */
  quoteVerified: boolean;
  citedInAnalysis?: boolean;
}

export interface MedicalChronology {
  status: "completed" | "partial" | "failed";
  documents: Array<{
    recordId: string;
    documentName: string;
    pageCount: number;
    unreadablePages: number[];
  }>;
  events: ChronologyEvent[];
  pagesProcessed: number;
  warnings: string[];
  generatedAt: string;
}

/** An uploaded record, as the upload endpoint returns it. */
export interface CaseRecordSummary {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  readablePages: number;
  unreadablePages: number[];
  createdAt: string;
}

export interface PublicReference {
  id: string;
  title: string;
  source: PublicSourceName;
  url: string;
  year?: number;
  excerpt?: string;
  /** Present on real PubMed results; absent on older demo reports. */
  pmid?: string;
  doi?: string;
  pmcid?: string;
  authors?: string;
  journal?: string;
  /** Study design, e.g. "Meta-analysis". */
  publicationType?: string;
  /** Free full text (PubMed Central). */
  fullTextUrl?: string;
}

export interface LiteratureSearchSummary {
  status: "completed" | "no_results" | "unavailable" | "disabled";
  provider: "PubMed";
  queries: string[];
  queryMethod: "ai" | "keywords";
  abstractsAvailable: boolean;
  searchedAt: string;
  message?: string;
}

export interface PrivateReference {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  citationText: string;
  summary?: string;
  excerpt?: string;
  classification?: EvidenceClassificationType;
  relevanceScore?: number;
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
    /** simulated appears only on reports saved before the live search. */
    status: "live" | "unavailable" | "disabled" | "simulated";
    count?: number;
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
  /** Absent on reports saved before the live literature search. */
  literatureSearch?: LiteratureSearchSummary;
  /** Present when medical records were uploaded with the case. */
  chronology?: MedicalChronology;
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
  /** Uploaded medical records to read into the chronology. */
  recordIds?: string[];
};

export const TERMS_ACKNOWLEDGMENT =
  "I understand that this software is intended for informational and legal research purposes only and does not constitute medical advice.";
