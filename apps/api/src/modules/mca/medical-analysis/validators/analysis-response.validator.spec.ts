import {
  AnalysisResponseMapper,
  AnalysisSafetyValidator,
  scrubUnverifiedReferences,
  verifiedReferencesFrom,
} from './analysis-response.validator';
import { createMockRetrievalResult } from '../testing/retrieval-result.mock';
import type { AnalysisCitation, MedicalAnalysisLlmOutput } from '../types';

const pubmedCitation: AnalysisCitation = {
  chunkId: 'pmid-31234567',
  documentName: 'Stroke after TBI',
  pageNumber: null,
  chunkNumber: 0,
  similarityScore: 0,
  citationText: '[PubMed PMID 31234567: Stroke after TBI (Stroke, 2019)]',
  sourceFile: 'https://pubmed.ncbi.nlm.nih.gov/31234567/',
  sourceKind: 'public_literature',
  url: 'https://pubmed.ncbi.nlm.nih.gov/31234567/',
};

function llmOutput(
  overrides: Partial<MedicalAnalysisLlmOutput> = {},
): MedicalAnalysisLlmOutput {
  return {
    executiveSummary: 'Summary',
    patientSummary: '',
    medicalQuestion: '',
    retrievedEvidence: [],
    supportingEvidence: [],
    opposingEvidence: [],
    aiReasoning: 'Reasoning',
    confidenceScore: 50,
    confidenceExplanation: '',
    limitations: [],
    conclusion: 'Conclusion',
    citations: [],
    ...overrides,
  };
}

describe('scrubUnverifiedReferences', () => {
  const verified = verifiedReferencesFrom([pubmedCitation]);

  it('keeps links and PMIDs of sources the model was given', () => {
    const text =
      'See PMID 31234567 at https://pubmed.ncbi.nlm.nih.gov/31234567/.';
    expect(scrubUnverifiedReferences(text, verified)).toEqual({
      text,
      removed: 0,
    });
  });

  it('removes links, PMIDs, and DOIs the model was not given', () => {
    const result = scrubUnverifiedReferences(
      'A cohort (PMID: 99999999, doi:10.1000/fake.123) at https://example.org/study showed risk.',
      verified,
    );
    expect(result.removed).toBe(3);
    expect(result.text).not.toMatch(/99999999|10\.1000|example\.org/);
    expect(result.text).toContain('[unverified PMID removed]');
    expect(result.text).toContain('[unverified link removed]');
  });
});

describe('AnalysisSafetyValidator', () => {
  const validator = new AnalysisSafetyValidator();

  it('scrubs every free-text field but leaves excerpts as quoted', () => {
    const { output, removed } = validator.scrubFreeText(
      llmOutput({
        aiReasoning: 'Per https://made-up.example/paper the risk doubles.',
        generalMedicalKnowledge: ['Shown in PMID 12345678.'],
        supportingEvidence: [
          {
            chunkId: 'doc:0',
            excerpt: 'quoted https://in-source.example',
            reasoning: 'doi:10.5555/xyz',
          },
        ],
      }),
      verifiedReferencesFrom([]),
    );
    expect(removed).toBe(3);
    expect(output.aiReasoning).toContain('[unverified link removed]');
    expect(output.generalMedicalKnowledge?.[0]).toContain(
      '[unverified PMID removed]',
    );
    expect(output.supportingEvidence[0].excerpt).toBe(
      'quoted https://in-source.example',
    );
  });

  it('drops unknown chunkIds from alternative explanations', () => {
    const result = validator.removeUnknownCitations(
      llmOutput({
        alternativeExplanations: [
          {
            explanation: 'Atrial fibrillation',
            assessment: 'Not documented',
            basis: 'cited_evidence',
            chunkIds: ['doc:0', 'fake:1'],
          },
        ],
      }),
      new Set(['doc:0']),
    );
    expect(result.removedChunkIds).toEqual(['fake:1']);
    expect(result.output.alternativeExplanations?.[0].chunkIds).toEqual([
      'doc:0',
    ]);
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

describe('AnalysisResponseMapper', () => {
  it('labels an alternative explanation cited only when a source backs it', () => {
    const mapped = new AnalysisResponseMapper().mapToResult({
      request: { medicalQuestion: 'Q' },
      llmOutput: llmOutput({
        alternativeExplanations: [
          {
            explanation: 'Hypertension',
            assessment: 'A common cause',
            basis: 'cited_evidence',
            chunkIds: [],
          },
          {
            explanation: 'Traumatic dissection',
            assessment: 'Supported by the study',
            basis: 'cited_evidence',
            chunkIds: ['pmid-31234567'],
          },
        ],
        generalMedicalKnowledge: ['  Stroke has many causes.  ', ''],
      }),
      citationMap: new Map([[pubmedCitation.chunkId, pubmedCitation]]),
      retrieval: createMockRetrievalResult(),
      analysisExecutionTimeMs: 1,
      llmProvider: 'gemini',
      llmModel: 'm',
    });

    expect(mapped.alternativeExplanations?.map((a) => a.basis)).toEqual([
      'general_knowledge',
      'cited_evidence',
    ]);
    expect(mapped.alternativeExplanations?.[1].citations[0].url).toBe(
      pubmedCitation.url,
    );
    expect(mapped.generalMedicalKnowledge).toEqual(['Stroke has many causes.']);
  });
});
