export type EwiJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EwiJobStep =
  | "intake"
  | "profile"
  | "credentials"
  | "scholarship"
  | "legal"
  | "public-web"
  | "discrepancy"
  | "questions"
  | "report";

export interface EwiCrossExamQuestion {
  number: number;
  category: string;
  question: string;
  evidenceBasis: string;
}

export interface EwiDiscrepancy {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  evidenceIds: string[];
  relatedUrls: string[];
}

export interface EwiEvidenceItem {
  sourceId: string;
  category: string;
  title: string;
  summary: string;
  url?: string;
  simulated?: boolean;
}

export interface EwiInvestigationResult {
  expertName: string;
  specialty: string;
  evidence: EwiEvidenceItem[];
  discrepancies: EwiDiscrepancy[];
  questions: EwiCrossExamQuestion[];
  questionCount: number;
  sourceStatuses: Array<{
    sourceId: string;
    status: string;
    message?: string;
    itemCount: number;
  }>;
  reportFileName: string;
  generatedAt: string;
  disclaimer: string;
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
  specialty: string;
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
  result: EwiInvestigationResult | null;
  reportMimeType: string | null;
}
