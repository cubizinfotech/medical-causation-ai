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
  /** Set when the cited page was read with OCR: its confidence, 0–100. */
  ocrConfidence?: number;
}

export interface ChronologyDocument {
  recordId: string;
  documentName: string;
  pageCount: number;
  /** Pages with no usable text: blank, or scanned and not readable with OCR. */
  unreadablePages: number[];
  /** Scanned pages whose text was read with OCR. */
  ocrPages?: number[];
  /** OCR pages read with low confidence; check them against the original. */
  lowConfidencePages?: number[];
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

export type DefenseIssueKind =
  | 'delayed_treatment'
  | 'treatment_gap'
  | 'pre_existing'
  | 'degenerative'
  | 'non_compliance'
  | 'intervening_event'
  | 'attorney_involvement'
  | 'reported_history';

export interface DefenseIssueEvidence {
  source: 'record' | 'intake';
  /** Chronology citation id (rec-N) when the evidence is a chronology entry. */
  chronologyId?: string;
  recordId?: string;
  documentName?: string;
  pageNumber?: number;
  date?: string;
  /** Exact words from the record page or the intake form. */
  quote: string;
}

/** A fact the defense is likely to raise, found by fixed rules. */
export interface DefenseIssue {
  id: string;
  kind: DefenseIssueKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  /** What the records show, stated factually. */
  detail: string;
  defenseArgument: string;
  /** What to check or prepare. */
  response: string;
  evidence: DefenseIssueEvidence[];
}

export interface DefenseIssuesSummary {
  /** limited: no records or no full accident date, so some checks were skipped. */
  status: 'completed' | 'limited';
  issues: DefenseIssue[];
  notes: string[];
}

/** One charge line read from a bill, cited to its page. */
export interface BillingCharge {
  /** Citation id, e.g. "chg-3". */
  id: string;
  provider: string;
  /** YYYY-MM-DD, or "" when no date of service is printed for the line. */
  dateOfService: string;
  description: string;
  /** CPT, HCPCS, or revenue code; only kept when printed on the page. */
  code?: string;
  /** Dollars. */
  amount: number;
  /** The amount exactly as printed. */
  amountText: string;
  recordId: string;
  documentName: string;
  pageNumber: number;
  batesNumbers: string[];
  quote: string;
  /** False when the line could not be found on the cited page. */
  quoteVerified: boolean;
  /** The same charge already counted from another page; left out of totals. */
  duplicateOf?: string;
  ocrConfidence?: number;
}

export type BillingTotalKind =
  'total_charges' | 'payments' | 'adjustments' | 'balance';

/** A total printed on a bill. Shown as printed; never added across bills. */
export interface BillingPrintedTotal {
  provider: string;
  kind: BillingTotalKind;
  amount: number;
  amountText: string;
  recordId: string;
  documentName: string;
  pageNumber: number;
  quote: string;
}

export interface ProviderBilling {
  provider: string;
  firstDate: string;
  lastDate: string;
  /** Sum of the charge lines, or the printed total when no lines were read. */
  billed: number;
  billedFrom: 'charges' | 'printed_total';
  chargeCount: number;
  printedTotals: BillingPrintedTotal[];
  /** The charge lines read do not add up to the total printed on the bill. */
  mismatch?: {
    printed: number;
    read: number;
    documentName: string;
    pageNumber: number;
  };
}

/** A treating provider in the chronology with no bill in the records. */
export interface UnbilledProvider {
  provider: string;
  firstDate: string;
  lastDate: string;
  visits: number;
  chronologyIds: string[];
}

/** Medical expenses read from the bills in the uploaded records. */
export interface MedicalSpecials {
  /** no_bills: no page looked like a bill. */
  status: 'completed' | 'partial' | 'failed' | 'no_bills';
  charges: BillingCharge[];
  providers: ProviderBilling[];
  /** Sum of billed amounts across providers, duplicates excluded. */
  totalBilled: number;
  billPages: Array<{ recordId: string; documentName: string; pages: number[] }>;
  unbilledProviders: UnbilledProvider[];
  warnings: string[];
  generatedAt: string;
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
  /** "Bad facts" the defense is likely to raise. Absent on older reports. */
  defenseIssues?: DefenseIssuesSummary;
  /** Bills read from the uploaded records. Absent without records. */
  medicalSpecials?: MedicalSpecials;
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
