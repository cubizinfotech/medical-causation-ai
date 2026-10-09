import { MedicalQueryBuilder } from '../builders';
import { MedicalAnalysisService } from './medical-analysis.service';
import type { CaseLiteratureService } from './case-literature.service';
import type { CaseRecordsService } from '../records/case-records.service';
import type { ChronologyExtractionService } from '../records/chronology-extraction.service';
import type { BillingExtractionService } from '../records/billing-extraction.service';
import type { AiService } from '@ai/services';
import type { RetrievalService } from '@modules/rag/services';
import type { AnalysisPromptBuilder } from '../builders';
import { AnalysisResponseMapper, AnalysisSafetyValidator } from '../validators';
import { createMockRetrievalResult } from '../testing/retrieval-result.mock';

describe('MedicalAnalysisService', () => {
  const retrievalResult = createMockRetrievalResult({
    chunks: [
      {
        chunkId: 'doc:0',
        documentId: 'doc-id',
        knowledgeDocumentId: 'kb-id',
        documentTitle: 'Book',
        text: 'Evidence text',
        chunkIndex: 0,
        totalChunks: 1,
        pageNumber: 1,
        section: null,
        category: 'medical_book',
        subCategory: null,
        sourceFile: 'book.pdf',
        sourceType: 'internal_kb',
        vectorScore: 0.8,
        keywordScore: 0.5,
        combinedScore: 0.8,
        citation: {
          documentName: 'Book',
          pageNumber: 1,
          chunkNumber: 1,
          category: 'medical_book',
          subCategory: null,
          similarityScore: 0.8,
          citationText: '[Source: Book, p. 1, chunk 1]',
          sourceFile: 'book.pdf',
          knowledgeDocumentId: 'kb-id',
        },
      },
    ],
    context: {
      contextText: 'Retrieved context',
      citations: [],
      chunkCount: 1,
      estimatedTokens: 100,
      truncated: false,
    },
    executionTimeMs: 50,
  });

  const builtPrompts = {
    systemPrompt: 'System',
    userPrompt: 'User',
    allowedChunkIds: ['doc:0'],
    citationCatalog: [
      {
        chunkId: 'doc:0',
        documentName: 'AMA Book',
        pageNumber: 42,
        chunkNumber: 1,
        similarityScore: 0.8,
        citationText: '[Source: AMA Book, p. 42, chunk 1]',
        sourceFile: 'ama.pdf',
      },
    ],
  };

  const llmJson = {
    literatureSearch: {
      exposureTerms: ['traumatic brain injury'],
      outcomeTerms: ['stroke'],
      queries: ['stroke risk after traumatic brain injury'],
    },
    executiveSummary: 'Summary',
    patientSummary: 'Patient',
    medicalQuestion: 'Can mild TBI increase stroke risk?',
    retrievedEvidence: [
      {
        chunkId: 'doc:0',
        excerpt: 'Evidence excerpt',
        classification: 'supporting',
        classificationReasoning: 'Supports association',
      },
    ],
    supportingEvidence: [
      {
        chunkId: 'doc:0',
        excerpt: 'Supporting excerpt',
        reasoning: 'Supports causation',
      },
    ],
    opposingEvidence: [],
    neutralEvidence: [],
    aiReasoning: 'Based on retrieved evidence...',
    confidenceScore: 72,
    confidenceExplanation: 'Moderate supporting evidence',
    limitations: ['Limited to indexed sources'],
    conclusion: 'Possible association',
    citations: [
      { chunkId: 'doc:0', statement: 'TBI may increase stroke risk' },
    ],
  };

  const mappedResult = {
    executiveSummary: 'Summary',
    patientSummary: 'Patient',
    medicalQuestion: 'Can mild TBI increase stroke risk?',
    retrievedEvidence: [],
    supportingEvidence: [],
    opposingEvidence: [],
    neutralEvidence: [],
    aiReasoning: 'Based on retrieved evidence...',
    confidenceScore: {
      score: 72,
      explanation: 'Moderate supporting evidence',
      disclaimer: 'Not a diagnosis',
    },
    limitations: ['Limited to indexed sources'],
    conclusion: 'Possible association',
    citations: builtPrompts.citationCatalog,
    metadata: {
      retrievalExecutionTimeMs: 50,
      analysisExecutionTimeMs: 100,
      llmProvider: 'openrouter',
      llmModel: 'test-model',
      chunkCount: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
  };

  let service: MedicalAnalysisService;
  let retrievalService: jest.Mocked<Pick<RetrievalService, 'retrieve'>>;
  let aiService: jest.Mocked<Pick<AiService, 'complete'>>;
  let safetyValidator: AnalysisSafetyValidator;
  let responseMapper: jest.Mocked<Pick<AnalysisResponseMapper, 'mapToResult'>>;
  let reportEnrichment: { enrich: jest.Mock };
  const literatureResult = {
    summary: {
      status: 'completed',
      provider: 'PubMed',
      queries: ['stroke risk after traumatic brain injury'],
      queryMethod: 'ai',
      abstractsAvailable: true,
      searchedAt: '2026-01-01T00:00:00.000Z',
    },
    references: [],
  };
  const research = jest.fn().mockResolvedValue(literatureResult);
  const caseLiterature = { research } as unknown as CaseLiteratureService;
  const loadedRecords = [
    {
      id: 'record-1',
      name: 'er.pdf',
      pageCount: 2,
      unreadablePages: [],
      ocrPages: [],
      pages: [],
    },
  ];
  const chronology = {
    status: 'completed',
    documents: [],
    events: [],
    pagesProcessed: 2,
    warnings: [],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
  const loadForAnalysis = jest.fn().mockResolvedValue(loadedRecords);
  const readScannedPages = jest
    .fn()
    .mockResolvedValue({ attempted: 0, read: 0 });
  const caseRecords = {
    loadForAnalysis,
    readScannedPages,
    chronologySettings: {
      chronologyBatchChars: 12000,
      chronologyPromptChars: 10000,
      ocrLowConfidence: 60,
    },
  } as unknown as CaseRecordsService;
  const buildChronology = jest.fn().mockResolvedValue(chronology);
  const chronologyExtraction = {
    build: buildChronology,
  } as unknown as ChronologyExtractionService;
  const specials = { status: 'no_bills', charges: [], providers: [] };
  const buildSpecials = jest.fn().mockResolvedValue(specials);
  const billingExtraction = {
    build: buildSpecials,
  } as unknown as BillingExtractionService;
  let buildPrompts: jest.Mock;

  beforeEach(() => {
    retrievalService = {
      retrieve: jest.fn().mockResolvedValue(retrievalResult),
    };
    aiService = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify(llmJson),
        model: 'test-model',
        provider: 'openrouter',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        executionTimeMs: 10,
      }),
    };
    safetyValidator = new AnalysisSafetyValidator();
    responseMapper = { mapToResult: jest.fn().mockReturnValue(mappedResult) };
    reportEnrichment = {
      enrich: jest.fn().mockImplementation(() => ({
        ...mappedResult,
        causationOpinion: mappedResult.conclusion,
        timelineEvents: [],
        riskFactors: [],
        publicReferences: [],
        privateReferences: [],
        crossExamination: [],
        researchSources: { private: [], public: [] },
        legalDisclaimer: 'Disclaimer',
      })),
    };

    buildPrompts = jest.fn().mockResolvedValue(builtPrompts);
    loadForAnalysis.mockClear();
    buildChronology.mockClear();

    service = new MedicalAnalysisService(
      retrievalService as unknown as RetrievalService,
      aiService as unknown as AiService,
      new MedicalQueryBuilder(),
      { build: buildPrompts } as unknown as AnalysisPromptBuilder,
      safetyValidator,
      responseMapper,
      reportEnrichment,
      caseLiterature,
      caseRecords,
      chronologyExtraction,
      billingExtraction,
    );
  });

  it('should retrieve context before calling LLM', async () => {
    const result = await service.analyze({
      medicalQuestion: 'Can mild TBI increase stroke risk?',
    });

    expect(retrievalService.retrieve).toHaveBeenCalled();
    expect(aiService.complete).toHaveBeenCalled();
    expect(retrievalService.retrieve.mock.invocationCallOrder[0]).toBeLessThan(
      aiService.complete.mock.invocationCallOrder[0],
    );
    expect(aiService.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({ role: 'system', content: 'System' }),
          expect.objectContaining({ role: 'user', content: 'User' }),
        ],
        metadata: { responseFormat: 'json' },
      }),
    );
    expect(responseMapper.mapToResult).toHaveBeenCalled();
    // The search reuses the analysis model's suggested queries.
    expect(research).toHaveBeenCalledWith(
      expect.anything(),
      llmJson.literatureSearch,
    );
    expect(reportEnrichment.enrich).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      literatureResult,
      undefined,
      expect.objectContaining({ status: 'limited', issues: [] }),
      undefined,
    );
    // No records attached: the chronology and bill steps are skipped.
    expect(loadForAnalysis).not.toHaveBeenCalled();
    expect(buildSpecials).not.toHaveBeenCalled();
    expect(result.confidenceScore.score).toBe(72);
  });

  it('should reject when retrieval returns no context', async () => {
    retrievalService.retrieve.mockResolvedValue(
      createMockRetrievalResult({
        chunks: [],
        context: {
          contextText: '',
          citations: [],
          chunkCount: 0,
          estimatedTokens: 0,
          truncated: false,
        },
      }),
    );

    await expect(
      service.analyze({ medicalQuestion: 'Test question?' }),
    ).rejects.toThrow('No retrieved evidence available');
  });

  it('should retry when LLM returns invalid JSON', async () => {
    aiService.complete
      .mockResolvedValueOnce({
        content: 'Here is my analysis in plain text without JSON.',
        model: 'test-model',
        provider: 'openrouter',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        executionTimeMs: 10,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(llmJson),
        model: 'test-model',
        provider: 'openrouter',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        executionTimeMs: 10,
      });

    await service.analyze({
      medicalQuestion: 'Can mild TBI increase stroke risk?',
    });

    expect(aiService.complete).toHaveBeenCalledTimes(2);
  });

  it('reads attached records into a chronology before the analysis', async () => {
    await service.analyze({
      medicalQuestion: 'Can mild TBI increase stroke risk?',
      recordIds: ['record-1'],
    });

    // Scanned pages are read with OCR before the records are loaded.
    expect(readScannedPages).toHaveBeenCalledWith(
      ['record-1'],
      expect.any(Function),
    );
    expect(readScannedPages.mock.invocationCallOrder[0]).toBeLessThan(
      loadForAnalysis.mock.invocationCallOrder[0],
    );
    expect(loadForAnalysis).toHaveBeenCalledWith(['record-1']);
    expect(buildChronology).toHaveBeenCalledWith(
      loadedRecords,
      12000,
      expect.any(Function),
      { lowConfidence: 60, error: undefined },
    );
    // The rule-based defense issues go to the prompt and the report.
    const issues: unknown = expect.objectContaining({
      issues: expect.any(Array) as unknown,
    });
    expect(buildPrompts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      chronology,
      10000,
      issues,
    );
    expect(reportEnrichment.enrich).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      literatureResult,
      chronology,
      issues,
      specials,
    );
    // Bills are read after the chronology, which lists the providers.
    expect(buildSpecials).toHaveBeenCalledWith(
      loadedRecords,
      chronology.events,
      expect.any(Function),
    );
  });
});
