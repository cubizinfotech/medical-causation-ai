import { Injectable } from '@nestjs/common';
import type { MedicalAnalysisRequest } from '../types';
import type { RetrievalRequest } from '@modules/rag/types';

@Injectable()
export class MedicalQueryBuilder {
  buildRetrievalRequest(request: MedicalAnalysisRequest): RetrievalRequest {
    return {
      question: request.medicalQuestion,
      patientInformation: request.patientInformation,
      injury: request.injury,
      diagnosis: request.diagnosis,
      symptoms: request.symptoms,
      medicalHistory: request.medicalHistory,
      filters: request.filters,
      topK: request.topK,
    };
  }

  buildCaseContext(request: MedicalAnalysisRequest): string {
    const parts = [
      request.patientInformation
        ? `Patient Information: ${request.patientInformation}`
        : '',
      request.injury ? `Injury/Trauma: ${request.injury}` : '',
      request.diagnosis ? `Diagnosis: ${request.diagnosis}` : '',
      request.symptoms ? `Symptoms: ${request.symptoms}` : '',
      request.medicalHistory
        ? `Medical History: ${request.medicalHistory}`
        : '',
      request.accidentDate ? `Accident Date: ${request.accidentDate}` : '',
      request.preExistingConditions
        ? `Pre-existing Conditions: ${request.preExistingConditions}`
        : '',
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join('\n')
      : 'No additional case context provided.';
  }
}
