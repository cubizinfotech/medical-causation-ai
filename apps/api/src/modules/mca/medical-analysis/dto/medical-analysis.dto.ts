export interface MedicalAnalysisResponseDto {
  executiveSummary: string;
  medicalQuestion: string;
  confidenceScore: number;
  conclusion: string;
  citationCount: number;
  supportingCount: number;
  opposingCount: number;
}
