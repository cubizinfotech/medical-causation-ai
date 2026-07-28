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
});
