import { AnalysisSafetyValidator } from './analysis-response.validator';
import { createMockRetrievalResult } from '../testing/retrieval-result.mock';

describe('AnalysisSafetyValidator', () => {
  const validator = new AnalysisSafetyValidator();

  it('should reject empty retrieval context', () => {
    const retrieval = createMockRetrievalResult({
      chunks: [],
      context: {
        contextText: '',
        citations: [],
        chunkCount: 0,
        estimatedTokens: 0,
        truncated: false,
      },
    });

    expect(() => validator.validateRetrievalHasContext(retrieval)).toThrow();
  });

  it('should reject hallucinated chunkIds', () => {
    const citationMap = new Map([
      [
        'doc:0',
        {
          chunkId: 'doc:0',
          documentName: 'Book',
          pageNumber: 1,
          chunkNumber: 1,
          similarityScore: 0.5,
          citationText: '[Source: Book, p. 1, chunk 1]',
          sourceFile: 'book.pdf',
        },
      ],
    ]);

    expect(() =>
      validator.validateCitations(
        {
          executiveSummary: '',
          patientSummary: '',
          medicalQuestion: '',
          retrievedEvidence: [
            {
              chunkId: 'fake:99',
              excerpt: '',
              classification: 'unknown',
              classificationReasoning: '',
            },
          ],
          supportingEvidence: [],
          opposingEvidence: [],
          aiReasoning: '',
          confidenceScore: 0,
          confidenceExplanation: '',
          limitations: [],
          conclusion: '',
          citations: [],
        },
        new Set(['doc:0']),
        citationMap,
      ),
    ).toThrow();
  });

  it('should remove unknown chunkIds while preserving valid evidence', () => {
    const result = validator.removeUnknownCitations(
      {
        executiveSummary: 'Summary',
        patientSummary: '',
        medicalQuestion: '',
        retrievedEvidence: [
          {
            chunkId: 'doc:0',
            excerpt: 'valid',
            classification: 'unknown',
            classificationReasoning: '',
          },
          {
            chunkId: 'fake:99',
            excerpt: 'invalid',
            classification: 'unknown',
            classificationReasoning: '',
          },
        ],
        supportingEvidence: [],
        opposingEvidence: [],
        aiReasoning: '',
        confidenceScore: 50,
        confidenceExplanation: '',
        limitations: [],
        conclusion: 'Conclusion',
        citations: [{ chunkId: 'fake:99', statement: 'invalid' }],
      },
      new Set(['doc:0']),
    );

    expect(result.removedChunkIds).toEqual(['fake:99']);
    expect(result.output.retrievedEvidence).toHaveLength(1);
    expect(result.output.citations).toHaveLength(0);
  });
});
