import { Injectable } from '@nestjs/common';
import type {
  BaseMedicalAnalysisResult,
  DefenseIssuesSummary,
  LiteratureSearchSummary,
  MedicalAnalysisRequest,
  MedicalChronology,
  MedicalAnalysisResult,
  MedicalSpecials,
  ResearchSourcesSummary,
} from '../types';
import type { CaseLiteratureResult } from './case-literature.service';
import {
  LEGAL_DISCLAIMER_TEXT,
  buildPrivateSourceSummary,
  buildTimelineEvents,
  formatKnowledgeBaseDocumentName,
  generateCrossExamination,
  inferRiskFactors,
} from './report-enrichment.helpers';

function publicSources(
  literature: LiteratureSearchSummary,
  referenceCount: number,
): ResearchSourcesSummary['public'] {
  const searchStatus =
    literature.status === 'disabled'
      ? 'disabled'
      : literature.status === 'unavailable'
        ? 'unavailable'
        : 'live';
  const sources: ResearchSourcesSummary['public'] = [
    {
      name: 'PubMed',
      description:
        'National Library of Medicine database of peer-reviewed biomedical studies, ranked by PubMed Best Match',
      status: searchStatus,
      count: referenceCount,
    },
  ];
  if (referenceCount > 0) {
    sources.push({
      name: 'Europe PMC',
      description: 'Abstract excerpts and free full-text availability',
      status: literature.abstractsAvailable ? 'live' : 'unavailable',
    });
  }
  return sources;
}

@Injectable()
export class ReportEnrichmentService {
  enrich(
    result: BaseMedicalAnalysisResult,
    request: MedicalAnalysisRequest,
    literature: CaseLiteratureResult,
    chronology?: MedicalChronology,
    defenseIssues?: DefenseIssuesSummary,
    medicalSpecials?: MedicalSpecials,
  ): MedicalAnalysisResult {
    const publicReferences = literature.references;

    const evidenceByChunk = new Map(
      result.retrievedEvidence.map((item) => [item.chunkId, item]),
    );

    // Record citations appear in the chronology, not as library sources.
    const libraryCitations = result.citations.filter(
      (citation) => citation.sourceKind !== 'medical_record',
    );
    const citedIds = new Set(result.citations.map((c) => c.chunkId));

    const privateReferences = libraryCitations.map((citation) => {
      const evidence = evidenceByChunk.get(citation.chunkId);
      return {
        chunkId: citation.chunkId,
        documentName: formatKnowledgeBaseDocumentName(citation.documentName),
        pageNumber: citation.pageNumber,
        citationText: citation.citationText,
        summary: buildPrivateSourceSummary({
          citation,
          classification: evidence?.classification,
        }),
        excerpt: evidence?.excerpt,
        classification: evidence?.classification,
        relevanceScore: citation.similarityScore,
        sourceFile: citation.sourceFile,
        sourceType: 'private_kb' as const,
      };
    });

    const uniqueDocumentCount = new Set(
      libraryCitations.map((citation) => citation.documentName),
    ).size;

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
      riskFactors: inferRiskFactors(request, result.opposingEvidence.length),
      publicReferences,
      literatureSearch: literature.summary,
      chronology: chronology
        ? {
            ...chronology,
            events: chronology.events.map((event) => ({
              ...event,
              citedInAnalysis: citedIds.has(event.id),
            })),
          }
        : undefined,
      ...(defenseIssues ? { defenseIssues } : {}),
      ...(medicalSpecials ? { medicalSpecials } : {}),
      privateReferences,
      crossExamination,
      researchSources: {
        private: [
          {
            name: 'Indexed Medical Library',
            description:
              'AMA guides, medical textbooks, and firm-uploaded reference documents',
            count: uniqueDocumentCount,
          },
          {
            name: 'Retrieved Evidence Passages',
            description:
              'Knowledge-base excerpts matched to this case via hybrid search',
            count: privateReferences.length,
          },
          ...(chronology
            ? [
                {
                  name: 'Client Medical Records',
                  description: `Uploaded records, read into ${chronology.events.length} cited chronology entries`,
                  count: chronology.documents.length,
                },
              ]
            : []),
        ],
        public: publicSources(literature.summary, publicReferences.length),
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
