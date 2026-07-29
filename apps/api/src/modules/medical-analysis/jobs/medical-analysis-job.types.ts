import type { MedicalAnalysisRequest, MedicalAnalysisResult } from '../types';
import type { AnalysisJobStatus, AnalysisJobStep } from './medical-analysis-job.constants';

export interface MedicalAnalysisJobPayload {
  jobId: string;
  request: MedicalAnalysisRequest;
}

export interface AnalysisProgressUpdate {
  step: AnalysisJobStep;
  stepLabel: string;
  progress: number;
  message?: string;
}

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
