import type {
  AnalysisCitation,
  BaseMedicalAnalysisResult,
  MedicalChronology,
} from '../types';
import { ReportEnrichmentService } from './report-enrichment.service';

const libraryCitation: AnalysisCitation = {
  chunkId: 'doc:0',
  documentName: 'Brain Injury Medicine',
  pageNumber: 412,
  chunkNumber: 1,
  similarityScore: 0.8,
  citationText: '[Source: Brain Injury Medicine, p. 412]',
  sourceFile: 'tbi.pdf',
  sourceKind: 'knowledge_base',
};

const recordCitation: AnalysisCitation = {
  chunkId: 'rec-1',
  documentName: 'Medical record: er.pdf',
  pageNumber: 3,
  chunkNumber: 0,
  similarityScore: 1,
  citationText: '[Record: er.pdf, p. 3]',
  sourceFile: 'er.pdf',
  sourceKind: 'medical_record',
  recordId: 'record-1',
};

const baseResult = {
  executiveSummary: 'Summary',
  patientSummary: 'Patient',
  medicalQuestion: 'Did the concussion contribute to the stroke?',
  retrievedEvidence: [],
  supportingEvidence: [],
  opposingEvidence: [],
  neutralEvidence: [],
  aiReasoning: 'Reasoning',
  confidenceScore: { score: 60, explanation: '', disclaimer: '' },
  limitations: [],
  conclusion: 'Conclusion',
  citations: [libraryCitation, recordCitation],
  metadata: {
    retrievalExecutionTimeMs: 1,
    analysisExecutionTimeMs: 1,
    llmProvider: 'test',
    llmModel: 'test',
    chunkCount: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
  },
} as BaseMedicalAnalysisResult;

const event = {
  date: '2024-08-14',
  type: 'emergency' as const,
  summary: 'ER visit',
  diagnoses: [],
  treatments: [],
  medications: [],
  recordId: 'record-1',
  documentName: 'er.pdf',
  pageNumber: 3,
  batesNumbers: [],
  quote: '',
  quoteVerified: true,
};

const chronology: MedicalChronology = {
  status: 'completed',
  documents: [
    {
      recordId: 'record-1',
      documentName: 'er.pdf',
      pageCount: 4,
      unreadablePages: [],
    },
  ],
  events: [
    { ...event, id: 'rec-1' },
    { ...event, id: 'rec-2', summary: 'Follow-up' },
  ],
  pagesProcessed: 4,
  warnings: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
};

const literature = {
  summary: {
    status: 'disabled' as const,
    provider: 'PubMed' as const,
    queries: [],
    queryMethod: 'keywords' as const,
    abstractsAvailable: false,
    searchedAt: '2026-01-01T00:00:00.000Z',
  },
  references: [],
};

describe('ReportEnrichmentService', () => {
  const service = new ReportEnrichmentService();

  it('keeps record citations out of the library sources and marks cited entries', () => {
    const result = service.enrich(
      baseResult,
      { medicalQuestion: baseResult.medicalQuestion },
      literature,
      chronology,
    );

    expect(result.privateReferences.map((r) => r.chunkId)).toEqual(['doc:0']);
    expect(
      result.chronology?.events.map((e) => [e.id, e.citedInAnalysis]),
    ).toEqual([
      ['rec-1', true],
      ['rec-2', false],
    ]);
    expect(result.researchSources.private).toContainEqual(
      expect.objectContaining({ name: 'Client Medical Records', count: 1 }),
    );
  });

  it('has no chronology when no records were uploaded', () => {
    const result = service.enrich(
      { ...baseResult, citations: [libraryCitation] },
      { medicalQuestion: baseResult.medicalQuestion },
      literature,
    );
    expect(result.chronology).toBeUndefined();
    expect(
      result.researchSources.private.some(
        (s) => s.name === 'Client Medical Records',
      ),
    ).toBe(false);
  });
});
