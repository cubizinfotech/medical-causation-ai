import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import type { MedicalAnalysisRequest } from '../types';

export function mapCaseDtoToAnalysisRequest(
  dto: AnalyzeMedicalCaseDto,
): MedicalAnalysisRequest {
  const historyParts = [
    dto.medicalHistory ? `Prior History: ${dto.medicalHistory}` : '',
    dto.medications ? `Medications: ${dto.medications}` : '',
    dto.timeline ? `Timeline: ${dto.timeline}` : '',
  ].filter(Boolean);

  return {
    medicalQuestion: dto.medicalQuestion.trim(),
    patientInformation: `Name: ${dto.patientName}, Age: ${dto.patientAge}, Gender: ${dto.patientGender}`,
    injury: `${dto.accidentType}: ${dto.accidentDescription}`,
    diagnosis: dto.diagnosis,
    symptoms: dto.symptoms,
    medicalHistory:
      historyParts.length > 0 ? historyParts.join('\n') : undefined,
    accidentDate: dto.accidentDate,
  };
}
