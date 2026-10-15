import { createMockRetrievalResult } from '../testing/retrieval-result.mock';
import type { AnalysisCitation, BaseMedicalAnalysisResult } from '../types';
import {
  buildEvidenceBasis,
  capUncitedConfidence,
  libraryIsSufficient,
} from './evidence-basis.helpers';

function citation(
  chunkId: string,
  sourceKind?: AnalysisCitation['sourceKind'],
): AnalysisCitation {
  return {
    chunkId,
    documentName: chunkId,
    pageNumber: null,
    chunkNumber: 0,
    similarityScore: 0,
    citationText: chunkId,
    sourceFile: chunkId,
    sourceKind,
  };
}

function result(
  overrides: Partial<BaseMedicalAnalysisResult> = {},
): BaseMedicalAnalysisResult {
  return {
    executiveSummary: 'S',
    patientSummary: '',
    medicalQuestion: 'Q',
    retrievedEvidence: [],
    supportingEvidence: [],
    opposingEvidence: [],
    neutralEvidence: [],
    aiReasoning: 'R',
    confidenceScore: { score: 70, explanation: 'Strong.', disclaimer: 'D' },
    limitations: ['Existing limitation'],
    conclusion: 'C',
    citations: [],
    metadata: {
      retrievalExecutionTimeMs: 1,
      analysisExecutionTimeMs: 1,
      llmProvider: 'gemini',
      llmModel: 'm',
      chunkCount: 0,
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

const thin = createMockRetrievalResult({
  chunks: [],
  coverage: {
    searchMode: 'hybrid',
    relevantChunkCount: 0,
    topSimilarity: 0.6,
    relevanceThreshold: 0.75,
    sufficient: false,
  },
});

describe('libraryIsSufficient', () => {
  it('uses the coverage measure, or any passage when there is none', () => {
    expect(libraryIsSufficient(thin)).toBe(false);
    expect(libraryIsSufficient(createMockRetrievalResult({ chunks: [] }))).toBe(
      false,
    );
  });
});

describe('buildEvidenceBasis', () => {
  const offered = {
    libraryPassages: 0,
    literatureArticles: 3,
    recordEntries: 2,
  };

  it('names what a supplemented analysis actually cited', () => {
    const basis = buildEvidenceBasis({
      promptMode: 'supplemented',
      retrieval: thin,
      offered,
      result: result({
        citations: [
          citation('pmid-1', 'public_literature'),
          citation('rec-1', 'medical_record'),
        ],
        generalMedicalKnowledge: ['Hypertension is a stroke risk factor.'],
      }),
    });

    expect(basis.mode).toBe('literature');
    expect(basis.usesGeneralKnowledge).toBe(true);
    expect(basis.note).toContain('no passages that closely match');
    expect(basis.note).toContain(
      '3 published study abstracts from PubMed (1 cited)',
    );
    expect(basis.note).toContain('2 entries in the client');
    expect(basis.note).toContain('qualified medical expert');
  });

  it('says why no published studies were used', () => {
    const basis = buildEvidenceBasis({
      promptMode: 'supplemented',
      retrieval: thin,
      offered: { libraryPassages: 0, literatureArticles: 0, recordEntries: 0 },
      result: result(),
      literature: {
        status: 'disabled',
        provider: 'PubMed',
        queries: [],
        queryMethod: 'keywords',
        abstractsAvailable: false,
        searchedAt: '',
      },
    });

    expect(basis.mode).toBe('general_knowledge');
    expect(basis.note).toContain('turned off');
  });

  it('describes a library-backed analysis', () => {
    const basis = buildEvidenceBasis({
      promptMode: 'library',
      retrieval: createMockRetrievalResult({}),
      offered: { libraryPassages: 10, literatureArticles: 0, recordEntries: 0 },
      result: result({ citations: [citation('doc:1')] }),
    });
    expect(basis.mode).toBe('knowledge_base');
    expect(basis.note).toContain('10 passages from the firm');
    expect(basis.usesGeneralKnowledge).toBe(false);
  });
});

describe('capUncitedConfidence', () => {
  const basis = (mode: 'general_knowledge' | 'literature') =>
    buildEvidenceBasis({
      promptMode: 'supplemented',
      retrieval: thin,
      offered: { libraryPassages: 0, literatureArticles: 0, recordEntries: 0 },
      result: result({
        citations:
          mode === 'literature'
            ? [citation('pmid-1', 'public_literature')]
            : [],
      }),
    });

  it('caps confidence and adds a limitation when no source supports the analysis', () => {
    const capped = capUncitedConfidence(result(), basis('general_knowledge'));
    expect(capped.confidenceScore.score).toBe(39);
    expect(capped.confidenceScore.explanation).toContain('Capped at 39');
    expect(capped.limitations[0]).toMatch(
      /AI-generated from general medical knowledge/,
    );
    expect(capped.limitations).toContain('Existing limitation');
  });

  it('leaves a cited analysis alone', () => {
    const untouched = result();
    expect(capUncitedConfidence(untouched, basis('literature'))).toBe(
      untouched,
    );
  });
});
