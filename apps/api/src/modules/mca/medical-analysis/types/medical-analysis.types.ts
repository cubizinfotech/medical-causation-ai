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
  /** Present on real literature results; absent on older demo reports. */
  pmid?: string;
  doi?: string;
  pmcid?: string;
  /** e.g. "Smith J, Lee K, Park S, et al." */
  authors?: string;
  journal?: string;
  /** Study design label, e.g. "Meta-analysis". */
  publicationType?: string;
  /** Free full text (PubMed Central). */
  fullTextUrl?: string;
}

export type LiteratureSearchStatus =
  'completed' | 'no_results' | 'unavailable' | 'disabled';

/** How the public literature search ran for one analysis. */
export interface LiteratureSearchSummary {
  status: LiteratureSearchStatus;
  provider: 'PubMed';
  /** Exact queries sent to PubMed, so an attorney can re-run them. */
  queries: string[];
  /** ai = written by the AI provider; keywords = built from the diagnosis. */
  queryMethod: 'ai' | 'keywords';
  abstractsAvailable: boolean;
  searchedAt: string;
  message?: string;
}

export interface PrivateReference {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  citationText: string;
  /** Human-readable description for report display (no chunk IDs). */
  summary: string;
  excerpt?: string;
  classification?: EvidenceClassificationType;
  relevanceScore?: number;
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
    /** simulated appears only on reports saved before the live search. */
    status: 'live' | 'unavailable' | 'disabled' | 'simulated';
    count?: number;
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
  /** Uploaded medical records attached to this case. */
  recordIds?: string[];
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
  /** Absent on older reports, which only cited the knowledge base. */
  sourceKind?: 'knowledge_base' | 'medical_record';
  /** Set for medical_record citations: the uploaded record to open. */
  recordId?: string;
}

export type ChronologyEventType =
  | 'emergency'
  | 'office_visit'
  | 'hospital_admission'
  | 'imaging'
  | 'lab'
  | 'procedure'
  | 'surgery'
  | 'therapy'
  | 'medication'
  | 'other';

export interface ChronologyDiagnosis {
  description: string;
  /** Only kept when the code is printed on the cited page. */
  icd10?: string;
}

/** One dated medical event, cited to a page of an uploaded record. */
export interface ChronologyEvent {
  /** Citation id, e.g. "rec-3"; the analysis cites events by this id. */
  id: string;
  /** YYYY-MM-DD, YYYY-MM or YYYY; empty when the record gives no date. */
  date: string;
  type: ChronologyEventType;
  provider?: string;
  facility?: string;
  summary: string;
  diagnoses: ChronologyDiagnosis[];
  treatments: string[];
  medications: string[];
  recordId: string;
  documentName: string;
  pageNumber: number;
  batesNumbers: string[];
  /** Short passage from the page that supports the event. */
  quote: string;
  /** False when the quote could not be found on the cited page. */
  quoteVerified: boolean;
  citedInAnalysis?: boolean;
}

export interface ChronologyDocument {
  recordId: string;
  documentName: string;
  pageCount: number;
  /** Scanned or blank pages that were not read (OCR is not available yet). */
  unreadablePages: number[];
}

export interface MedicalChronology {
  /** partial: some pages could not be processed; see warnings. */
  status: 'completed' | 'partial' | 'failed';
  documents: ChronologyDocument[];
  events: ChronologyEvent[];
  pagesProcessed: number;
  warnings: string[];
  generatedAt: string;
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
  /** Suggested PubMed search; validated before use, may be absent. */
  literatureSearch?: unknown;
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
  /** Absent on reports saved before the live literature search. */
  literatureSearch?: LiteratureSearchSummary;
  /** Present when medical records were uploaded with the case. */
  chronology?: MedicalChronology;
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
