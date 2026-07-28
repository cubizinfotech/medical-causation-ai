import { Injectable } from '@nestjs/common';
import type {
  BaseMedicalAnalysisResult,
  MedicalAnalysisRequest,
  MedicalAnalysisResult,
} from '../types';
import {
  LEGAL_DISCLAIMER_TEXT,
  buildTimelineEvents,
  generateCrossExamination,
  inferRiskFactors,
  simulatePublicReferences,
} from './report-enrichment.helpers';

@Injectable()
export class ReportEnrichmentService {
  enrich(
    result: BaseMedicalAnalysisResult,
    request: MedicalAnalysisRequest,
  ): MedicalAnalysisResult {
    const publicReferences = simulatePublicReferences(
      request.medicalQuestion,
      request.diagnosis,
    );

    const privateReferences = result.citations.map((citation) => ({
      chunkId: citation.chunkId,
      documentName: citation.documentName,
      pageNumber: citation.pageNumber,
      citationText: citation.citationText,
      sourceFile: citation.sourceFile,
      sourceType: 'private_kb' as const,
    }));

    const crossExamination = generateCrossExamination(
      request.medicalQuestion,
      request.diagnosis,
    );

    const totalCrossExamQuestions = crossExamination.reduce(
      (sum, cat) => sum + cat.questions.length,
      0,
    );

    return {
      ...result,
      causationOpinion: result.conclusion,
      timelineEvents: buildTimelineEvents(request, result.conclusion),
      riskFactors: inferRiskFactors(
        request,
        result.opposingEvidence.length,
      ),
      publicReferences,
      privateReferences,
      crossExamination,
      researchSources: {
        private: [
          {
            name: 'Internal Knowledge Base',
            description: 'Uploaded books, medical PDFs, and indexed textbooks',
            count: result.metadata.chunkCount,
          },
          {
            name: 'AMA Guides & Private Library',
            description: 'Proprietary medical references and firm-uploaded documents',
            count: result.citations.length,
          },
        ],
        public: [
          { name: 'PubMed', description: 'Biomedical literature database', status: 'simulated' },
          { name: 'PubMed Central', description: 'Open-access full-text archive', status: 'simulated' },
          { name: 'NIH', description: 'National Institutes of Health resources', status: 'simulated' },
          { name: 'ClinicalTrials.gov', description: 'Clinical trial registry', status: 'simulated' },
          { name: 'Semantic Scholar', description: 'AI-powered research tool', status: 'simulated' },
          { name: 'Crossref', description: 'Scholarly metadata and citations', status: 'simulated' },
          { name: 'WHO', description: 'World Health Organization publications', status: 'simulated' },
          { name: 'CDC', description: 'Centers for Disease Control guidance', status: 'simulated' },
        ],
      },
      legalDisclaimer: LEGAL_DISCLAIMER_TEXT,
      metadata: {
        ...result.metadata,
        publicReferenceCount: publicReferences.length,
        privateReferenceCount: privateReferences.length,
        crossExamQuestionCount: totalCrossExamQuestions,
      },
    };
  }
}
