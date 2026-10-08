import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../../research/cross-exam-question.generator';
import type { EwiAnalysisRecord } from '../analysis/ewi-analysis.types';
import type { LegalResearchDossier } from '../../research/legal';
import type { OnlinePresenceDossier } from '../../research/online-presence';
import type { ProfessionalBackgroundDossier } from '../../research/professional-background';
import type {
  EwiJobStatus,
  EwiJobStep,
} from './ewi-investigation-job.constants';
import type {
  ProviderAttemptStatus,
  ResearchDisposition,
} from '../workflow/provider-attempt';
import type { InvestigationWorkflowCheckpoint } from '../workflow/investigation-workflow';

export interface EwiInvestigationRequest {
  expertName: string;
  city: string;
  specialty: string;
  /** Optional National Provider Identifier supplied by the attorney. */
  npi?: string;
}

export interface EwiSourceAttemptStatus {
  sourceId: string;
  /** Raw provider status (ok, no_result, error, unavailable). */
  status: string;
  /** Workflow attempt state. */
  attemptStatus: ProviderAttemptStatus;
  /** How the research should be interpreted. */
  disposition: ResearchDisposition;
  message?: string;
  itemCount: number;
  /** False when the provider was never consulted. */
  checked: boolean;
}

export interface EwiInvestigationResult {
  expertName: string;
  city: string;
  specialty: string;
  npi?: string | null;
  /** How the expert was identified in the NPI Registry. Null when not checked. */
  identity?: ExpertIdentityResolution | null;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  questionCount: number;
  sourceStatuses: EwiSourceAttemptStatus[];
  reportFileName: string;
  generatedAt: string;
  disclaimer: string;
  summary: string;
  analysis: EwiAnalysisRecord;
  legalResearch: LegalResearchDossier;
  onlinePresence: OnlinePresenceDossier;
  professionalBackground: ProfessionalBackgroundDossier;
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
  /** Resumable stage checkpoint when the worker is interrupted. */
  checkpoint?: InvestigationWorkflowCheckpoint;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEwiInvestigationJobResponse {
  investigationId: string;
  jobId: string;
  status: EwiJobStatus;
}
