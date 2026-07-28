import { mapCaseDtoToAnalysisRequest } from './case-request.mapper';
import type { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';

describe('mapCaseDtoToAnalysisRequest', () => {
  it('should map case form fields to analysis request', () => {
    const dto: AnalyzeMedicalCaseDto = {
      patientName: 'Jane Doe',
      patientAge: '45',
      patientGender: 'female',
      accidentDate: '2024-01-15',
      accidentType: 'Motor Vehicle Collision',
      accidentDescription: 'Rear-end collision at intersection.',
      diagnosis: 'Stroke',
      symptoms: 'Headache and confusion',
      medicalHistory: 'Hypertension',
      medications: 'Lisinopril',
      timeline: 'Symptoms began 2 weeks after accident',
      medicalQuestion: 'Can mild TBI increase stroke risk?',
    };

    const result = mapCaseDtoToAnalysisRequest(dto);

    expect(result.medicalQuestion).toBe('Can mild TBI increase stroke risk?');
    expect(result.patientInformation).toContain('Jane Doe');
    expect(result.injury).toContain('Motor Vehicle Collision');
    expect(result.medicalHistory).toContain('Hypertension');
  });
});
