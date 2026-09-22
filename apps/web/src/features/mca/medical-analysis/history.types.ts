import type { MedicalAnalysisResult } from "./types";
import type { AnalysisJobStatus } from "./job.types";

export interface AnalysisHistoryListItem {
  id: string;
  jobId: string;
  patientName: string;
  medicalQuestion: string;
  status: AnalysisJobStatus;
  progress: number;
  stepLabel: string | null;
  message: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AnalysisHistoryDetail extends AnalysisHistoryListItem {
  patientAge: string;
  patientGender: string;
  accidentDate: string;
  accidentType: string;
  accidentDescription: string;
  diagnosis: string;
  symptoms: string;
  medicalHistory: string | null;
  medications: string | null;
  timeline: string | null;
  step: string | null;
  errorMessage: string | null;
  result: MedicalAnalysisResult | null;
  updatedAt: string;
}
