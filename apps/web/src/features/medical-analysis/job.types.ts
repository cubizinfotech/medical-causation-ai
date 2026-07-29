import type { MedicalAnalysisResult } from "./types";

export type AnalysisJobStatus = "queued" | "running" | "completed" | "failed";

export type AnalysisJobStep =
  | "intake"
  | "private-kb"
  | "public-lit"
  | "evidence"
  | "reasoning"
  | "summary"
  | "cross-exam"
  | "report";

export interface MedicalAnalysisJobRecord {
  jobId: string;
  status: AnalysisJobStatus;
  step: AnalysisJobStep;
  stepLabel: string;
  progress: number;
  message?: string;
  error?: string;
  result?: MedicalAnalysisResult;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateMedicalAnalysisJobResponse {
  caseId: string;
  jobId: string;
  status: AnalysisJobStatus;
}

export interface MedicalAnalysisJobUpdate
  extends Pick<
    MedicalAnalysisJobRecord,
    | "jobId"
    | "status"
    | "step"
    | "stepLabel"
    | "progress"
    | "message"
    | "error"
    | "result"
    | "updatedAt"
    | "completedAt"
  > {}
