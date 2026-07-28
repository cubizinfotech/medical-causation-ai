import type { MedicalAnalysisRequest, MedicalAnalysisResult } from '../types';

export interface IMedicalAnalysisService {
  analyze(request: MedicalAnalysisRequest): Promise<MedicalAnalysisResult>;
}
