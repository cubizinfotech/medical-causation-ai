import { MedicalQueryBuilder } from '../builders';
import { MedicalAnalysisService } from './medical-analysis.service';
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
      enrich: jest.fn().mockImplementation((_result) => ({
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

    service = new MedicalAnalysisService(
      retrievalService as unknown as RetrievalService,
      aiService as unknown as AiService,
      new MedicalQueryBuilder(),
      {
        build: jest.fn().mockResolvedValue(builtPrompts),
      } as unknown as AnalysisPromptBuilder,
      safetyValidator,
      responseMapper,
      reportEnrichment as never,
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
});
