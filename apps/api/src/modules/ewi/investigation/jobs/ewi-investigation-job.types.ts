import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../../research/cross-exam-question.generator';
import type { EwiAnalysisRecord } from '../analysis/ewi-analysis.types';
import type {
  EwiJobStatus,
  EwiJobStep,
} from './ewi-investigation-job.constants';

export interface EwiInvestigationRequest {
  expertName: string;
  specialty: string;
}

export interface EwiInvestigationResult {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
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
  summary: string;
  analysis: EwiAnalysisRecord;
}

export interface EwiInvestigationJobPayload {
  jobId: string;
  request: EwiInvestigationRequest;
}

export interface EwiProgressUpdate {
  step: EwiJobStep;
  stepLabel: string;
  progress: number;
  message?: string;
}

export interface EwiInvestigationJobRecord {
  jobId: string;
  status: EwiJobStatus;
  step: EwiJobStep;
  stepLabel: string;
  progress: number;
  message?: string;
  error?: string;
  result?: EwiInvestigationResult;
  investigationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEwiInvestigationJobResponse {
  investigationId: string;
  jobId: string;
  status: EwiJobStatus;
}
