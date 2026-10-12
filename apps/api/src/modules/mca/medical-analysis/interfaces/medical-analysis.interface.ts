import type { MedicalAnalysisRequest, MedicalAnalysisResult } from '../types';
import type { AnalysisProgressUpdate } from '../jobs/medical-analysis-job.types';

export interface AnalyzeOptions {
  /** The analysis case; uploaded records are loaded only through it. */
  caseId?: string;
  onProgress?: (update: AnalysisProgressUpdate) => void | Promise<void>;
}

export interface IMedicalAnalysisService {
  analyze(
    request: MedicalAnalysisRequest,
    options?: AnalyzeOptions,
  ): Promise<MedicalAnalysisResult>;
}
