import type { EWI_PROGRESS_STEPS } from "@/features/ewi/constants";

export type EwiJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EwiJobStep = (typeof EWI_PROGRESS_STEPS)[number]["id"];

export interface EwiCrossExamQuestion {
  number: number;
  category: string;
  question: string;
  evidenceBasis: string;
}

export interface EwiInconsistencySource {
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  retrievedAt?: string;
  value: string;
  cvDate?: string;
}

export interface EwiDiscrepancy {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  evidenceIds: string[];
  relatedUrls: string[];
  label?: string;
  field?: string;
  previousValue?: string | null;
  currentValue?: string | null;
  change?: string | null;
  cvDate?: string | null;
  cvSource?: string | null;
  supportingSource?: string | null;
  priority?: number;
  sources?: EwiInconsistencySource[];
}

export interface EwiEvidenceItem {
  sourceId: string;
  category: string;
  title: string;
  summary: string;
  url?: string;
  simulated?: boolean;
}

export interface EwiSourceStatus {
  sourceId: string;
  status: string;
  attemptStatus?:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "skipped"
    | "unavailable"
    | "restricted";
  disposition?:
    | "completed"
    | "unavailable"
    | "not_applicable"
    | "paid_access"
    | "manual_action";
  message?: string;
  itemCount: number;
  checked?: boolean;
}

export interface EwiLegalMatter {
  id: string;
  documentType: string;
  caseName: string | null;
  caseNumber: string | null;
  court: string | null;
  jurisdiction: string | null;
  filingDate: string | null;
  documentDate: string | null;
  sourceUrl: string | null;
  sourceId: string;
  relevance: string | null;
  summary: string | null;
  findingsRegardingExpert: string | null;
  evidenceReference: string;
  title: string;
  restricted: boolean;
  orderTags?: string[];
  shortDescription?: string | null;
  transcriptMetadata?: string | null;
  importantStatements?: string[];
  citation?: string | null;
  challenge?: EwiExpertChallenge | null;
}

/** Daubert/Frye/Rule 702 challenge. The outcome is set only from the court's own words. */
export interface EwiExpertChallenge {
  standard: "daubert" | "frye" | "rule_702" | "unspecified";
  outcome:
    | "excluded"
    | "limited"
    | "admitted"
    | "not_challenged"
    | "not_determined";
  role: "challenged_expert" | "other" | "unclear";
  quote: string | null;
  basis: "court_text" | "not_determined";
  excerpts: string[];
  excerptSource: "opinion_text" | "search_snippet" | null;
  note: string;
}

export interface EwiIdentityCandidate {
  npi: string;
  name: string;
  credential: string | null;
  taxonomy: string | null;
  city: string | null;
  state: string | null;
  url: string;
}

/** How the expert was identified in the NPI Registry. */
export interface EwiIdentityResolution {
  status:
    | "confirmed"
    | "ambiguous"
    | "not_found"
    | "npi_mismatch"
    | "unavailable";
  identity: EwiIdentityCandidate | null;
  basis: string[];
  note: string;
  notes: string[];
  candidates: EwiIdentityCandidate[];
  simulated?: boolean;
}

/** The expert's CV, uploaded before the investigation starts. */
export interface EwiExpertDocumentSummary {
  id: string;
  kind: "cv";
  name: string;
  sizeBytes: number;
  pageCount: number;
  /** Pages with usable text now. */
  readablePages: number;
  /** Pages that will not be read: blank, or scanned when OCR is off. */
  unreadablePages: number[];
  /** Scanned pages read with OCR when the investigation runs. */
  ocrPendingPages: number[];
  createdAt: string;
}

export type EwiCvLabel =
  | "verified"
  | "partially_verified"
  | "conflicting"
  | "not_verified"
  | "not_found"
  | "unable_to_verify";

/** One statement the CV makes, quoted from its page. */
export interface EwiCvClaim {
  id: string;
  category: string;
  statement: string;
  page: number;
  quote: string;
}

/** A CV statement set against what a public source shows. */
export interface EwiCvComparison {
  id: string;
  topic: string;
  label: EwiCvLabel;
  severity: "high" | "medium" | "low";
  title: string;
  cv: {
    claimId?: string;
    statement: string;
    page?: number;
    quote?: string;
  } | null;
  source: { name: string; statement: string; url?: string } | null;
  note: string;
}

export interface EwiCvCheck {
  document: {
    id: string;
    name: string;
    pageCount: number;
    unreadablePages: number[];
    ocrPages: number[];
  };
  status: "completed" | "partial" | "failed";
  claims: EwiCvClaim[];
  comparisons: EwiCvComparison[];
  warnings: string[];
}

export interface EwiLegalResearch {
  matters: EwiLegalMatter[];
  orders: Array<{
    matter: EwiLegalMatter;
    significanceScore: number;
    significanceTags: string[];
    sortDate: string | null;
  }>;
  motionsAndPleadings: Array<{
    matter: EwiLegalMatter;
    sortDate: string | null;
    description: string;
  }>;
  depositions: Array<{
    matter: EwiLegalMatter;
    caseName: string | null;
    date: string | null;
    sourceLink: string | null;
    transcriptMetadata: string | null;
    summary: string | null;
    importantStatements: string[];
    contradictions: string[];
  }>;
  testimonyContradictions: Array<{
    id: string;
    description: string;
    relatedUrls: string[];
  }>;
  challenges?: Array<{
    matter: EwiLegalMatter;
    challenge: EwiExpertChallenge;
    sortDate: string | null;
  }>;
  sourceAttempts: Array<{
    sourceId: string;
    status: string;
    message?: string;
    itemCount: number;
  }>;
}

export interface EwiPresenceRecord {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  sourceId: string;
  sourceName: string;
  retrievedAt?: string | null;
  publishedAt?: string | null;
  summary: string | null;
  relevantClaims?: string[];
  advertisingClaims?: string[];
  forensicClaims?: string[];
  expertWitnessClaims?: string[];
  treatmentPracticeInfo?: string | null;
  conflictOrBiasIndicators?: string[];
  evidenceReferences?: string[];
  restricted?: boolean;
  platform?: string | null;
  description?: string | null;
  transcriptAvailable?: boolean | null;
  transcriptUnavailableReason?: string | null;
  importantStatements?: string[];
  rating?: string | null;
  reviewDate?: string | null;
  neutralSummary?: string | null;
  address?: string | null;
  businessName?: string | null;
  locationFlags?: string[];
  locationNote?: string | null;
}

export interface EwiOnlinePresence {
  websites: EwiPresenceRecord[];
  directories: EwiPresenceRecord[];
  ime: EwiPresenceRecord[];
  videos: EwiPresenceRecord[];
  social: EwiPresenceRecord[];
  newsAndBlogs: EwiPresenceRecord[];
  patientReviews: EwiPresenceRecord[];
  locations: EwiPresenceRecord[];
  otherPublicSites: EwiPresenceRecord[];
  records: EwiPresenceRecord[];
}

export interface EwiProfessionalRecord {
  id: string;
  kind: string;
  title: string;
  name?: string | null;
  identifier?: string | null;
  filingDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  role?: string | null;
  institution?: string | null;
  organization?: string | null;
  sourceUrl?: string | null;
  resultUrl?: string | null;
  resultsUnavailableReason?: string | null;
  cvClaim?: string | null;
  publicRecord?: string | null;
  paymentDate?: string | null;
  paymentAmount?: string | null;
  payer?: string | null;
  natureOfPayment?: string | null;
  hourlyRate?: string | null;
  percentForensicWork?: string | null;
  percentDefenseWork?: string | null;
  summary?: string | null;
  verificationNote?: string | null;
}

export interface EwiProfessionalBackground {
  grants: EwiProfessionalRecord[];
  patentsAndTrademarks: EwiProfessionalRecord[];
  awardsAndMedals: EwiProfessionalRecord[];
  militaryClaims: EwiProfessionalRecord[];
  memberships: EwiProfessionalRecord[];
  organizations: EwiProfessionalRecord[];
  corporateAffiliations: EwiProfessionalRecord[];
  financial: EwiProfessionalRecord[];
  records: EwiProfessionalRecord[];
}

export interface EwiInvestigationResult {
  expertName: string;
  city: string;
  specialty: string;
  npi?: string | null;
  identity?: EwiIdentityResolution | null;
  /** Present when the expert's CV was uploaded. */
  cvCheck?: EwiCvCheck | null;
  evidence: EwiEvidenceItem[];
  discrepancies: EwiDiscrepancy[];
  questions: EwiCrossExamQuestion[];
  questionCount: number;
  sourceStatuses: EwiSourceStatus[];
  reportFileName: string;
  generatedAt: string;
  disclaimer: string;
  summary?: string;
  legalResearch?: EwiLegalResearch;
  onlinePresence?: EwiOnlinePresence;
  professionalBackground?: EwiProfessionalBackground;
  analysis?: {
    origin?: 'ai' | 'deterministic';
    providerName?: string | null;
    document?: {
      schemaVersion?: string;
      summary?: string;
      missing?: Array<{
        category: string;
        assessment: string;
        note: string;
        sourceRefs?: string[];
      }>;
      sectionSummaries?: Array<{
        section: string;
        text: string;
        status: string;
        sourceRefs: string[];
        findingKeys: string[];
      }>;
      investigationFindings?: Array<{
        text: string;
        status: string;
        sourceRefs: string[];
      }>;
      questions?: Array<{
        category: string;
        question: string;
        sourceRefs: string[];
        uncertaintyNote?: string;
      }>;
    };
  };
}

export interface EwiInvestigationJobRecord {
  jobId: string;
  investigationId?: string;
  status: EwiJobStatus;
  step: EwiJobStep;
  stepLabel: string;
  progress: number;
  message?: string;
  error?: string;
  result?: EwiInvestigationResult;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEwiJobResponse {
  investigationId: string;
  jobId: string;
  status: EwiJobStatus;
}

export interface EwiHistoryListItem {
  id: string;
  jobId: string;
  expertName: string;
  city: string;
  specialty: string;
  npi?: string | null;
  status: EwiJobStatus;
  step: string | null;
  stepLabel: string | null;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  reportFileName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface EwiHistoryDetail extends EwiHistoryListItem {
  notes: string | null;
  /** The CV uploaded for this investigation, reused by Run again. */
  cvDocument?: { id: string; name: string; pageCount: number } | null;
  result: EwiInvestigationResult | null;
  reportMimeType: string | null;
}
