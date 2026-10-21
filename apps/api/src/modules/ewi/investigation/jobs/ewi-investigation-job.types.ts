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
import type { WebResearchDossier } from '@integrations/web-research';
import type { CvCheck } from '../../cv/cv.types';
import type {
  EwiJobStatus,
  EwiJobStep,
} from './ewi-investigation-job.constants';
import type {
  ResearchCoverage,
  ResearchOutcome,
} from '@integrations/expert-research';
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
  /** Optional free text: aliases, employers, case names. Helps tell same-name people apart. */
  additionalContext?: string;
  /** Optional uploaded CV of the expert. */
  cvDocumentId?: string;
}

export interface EwiSourceAttemptStatus {
  sourceId: string;
  /** Raw provider status (ok, no_result, error, unavailable). */
  status: string;
  /** Workflow attempt state. */
  attemptStatus: ProviderAttemptStatus;
  /** How the research should be interpreted. */
  disposition: ResearchDisposition;
  /** Normalized provider outcome when recorded. */
  outcome?: ResearchOutcome;
  /** Report-facing coverage; inferred on export when older records omit it. */
  coverage?: ResearchCoverage;
  message?: string;
  itemCount: number;
  /** False when the provider was never consulted. */
  checked: boolean;
  /** When the attempt finished, if recorded. */
  retrievedAt?: string;
}

export interface EwiInvestigationResult {
  expertName: string;
  city: string;
  specialty: string;
  npi?: string | null;
  additionalContext?: string | null;
  /** Everything the global web search found, by same-name candidate, with coverage. */
  webResearch?: WebResearchDossier | null;
  /** How the expert was identified in the NPI Registry. Null when not checked. */
  identity?: ExpertIdentityResolution | null;
  /** Claims in the uploaded CV compared with the sources. Null without a CV. */
  cvCheck?: CvCheck | null;
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
