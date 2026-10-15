import { MedicalPromptService } from '../prompts';
import { createMockRetrievalResult } from '../testing/retrieval-result.mock';
import type { MedicalChronology } from '../types';
import { AnalysisPromptBuilder } from './analysis-prompt.builder';
import { MedicalQueryBuilder } from './medical-query.builder';

const chronology: MedicalChronology = {
  status: 'completed',
  documents: [],
  pagesProcessed: 2,
  warnings: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
  events: [
    {
      id: 'rec-1',
      date: '2024-08-14',
      type: 'emergency',
      facility: 'St. Mary ED',
      summary: 'Concussion after rear-end collision',
      diagnoses: [{ description: 'Concussion with LOC', icd10: 'S06.0X1A' }],
      treatments: [],
      medications: [],
      recordId: 'record-1',
      documentName: 'er.pdf',
      pageNumber: 3,
      batesNumbers: ['ABC000123'],
      quote: 'brief loss of consciousness',
      quoteVerified: true,
    },
  ],
};

describe('AnalysisPromptBuilder', () => {
  const builder = new AnalysisPromptBuilder(
    new MedicalPromptService(),
    new MedicalQueryBuilder(),
  );
  const retrieval = createMockRetrievalResult({});
  const request = {
    medicalQuestion: 'Did the concussion contribute to the stroke?',
    diagnosis: 'Concussion; Ischemic stroke',
  };

  it('makes chronology entries citable alongside library passages', async () => {
    const built = await builder.build(request, retrieval, chronology);

    expect(built.allowedChunkIds).toContain('rec-1');
    expect(built.citationCatalog.find((c) => c.chunkId === 'rec-1')).toEqual(
      expect.objectContaining({
        sourceKind: 'medical_record',
        recordId: 'record-1',
        pageNumber: 3,
        documentName: 'Medical record: er.pdf',
        citationText: '[Record: er.pdf, p. 3, Bates ABC000123]',
      }),
    );
    expect(built.userPrompt).toContain('## Client Medical Records');
    expect(built.userPrompt).toContain(
      '- rec-1 | 2024-08-14 | Emergency visit',
    );
    expect(built.userPrompt).toContain('Concussion with LOC (S06.0X1A)');
  });

  it('says so when no records were provided', async () => {
    const built = await builder.build(request, retrieval);
    expect(built.userPrompt).toContain(
      'No medical records were provided for this case.',
    );
    expect(
      built.citationCatalog.some((c) => c.sourceKind === 'medical_record'),
    ).toBe(false);
  });

  it('keeps the library-only rules when the library covers the question', async () => {
    const built = await builder.build(request, retrieval);
    expect(built.mode).toBe('library');
    expect(built.systemPrompt).toContain('MUST NOT use outside knowledge');
    expect(built.systemPrompt).toContain(
      'NOT, by itself, evidence of causation',
    );
    expect(built.userPrompt).toContain('leave it empty ([])');
  });

  describe('supplemented mode (library coverage too thin)', () => {
    const libraryChunk = (id: string, relevant: boolean) => ({
      chunkId: id,
      documentId: 'doc',
      knowledgeDocumentId: 'kb',
      documentTitle: `Book ${id}`,
      text: `Passage ${id}`,
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 4,
      section: null,
      category: 'medical_book',
      subCategory: null,
      sourceFile: 'book.pdf',
      sourceType: 'internal_kb' as const,
      vectorScore: relevant ? 0.8 : 0.6,
      keywordScore: 0,
      combinedScore: 0.5,
      relevant,
      citation: {
        documentName: `Book ${id}`,
        pageNumber: 4,
        chunkNumber: 1,
        category: 'medical_book',
        subCategory: null,
        similarityScore: 0.8,
        citationText: `[Source: Book ${id}, p. 4]`,
        sourceFile: 'book.pdf',
        knowledgeDocumentId: 'kb',
      },
    });
    const thinRetrieval = createMockRetrievalResult({
      chunks: [
        libraryChunk('on-topic', true),
        libraryChunk('off-topic', false),
      ],
      coverage: {
        searchMode: 'hybrid',
        relevantChunkCount: 1,
        topSimilarity: 0.8,
        relevanceThreshold: 0.75,
        sufficient: false,
      },
    });
    const literature = [
      {
        id: 'pmid-31234567',
        title: 'Stroke risk after traumatic brain injury',
        source: 'PubMed' as const,
        url: 'https://pubmed.ncbi.nlm.nih.gov/31234567/',
        year: 2019,
        journal: 'Stroke',
        publicationType: 'Meta-analysis',
        pmid: '31234567',
        excerpt: 'TBI was associated with a higher risk of ischemic stroke.',
      },
      {
        id: 'pmid-999',
        title: 'Title only, no abstract',
        source: 'PubMed' as const,
        url: 'https://pubmed.ncbi.nlm.nih.gov/999/',
      },
    ];

    it('offers relevant passages and PubMed abstracts as citable evidence', async () => {
      const built = await builder.build(
        request,
        thinRetrieval,
        chronology,
        undefined,
        undefined,
        { mode: 'supplemented', literature },
      );

      expect(built.mode).toBe('supplemented');
      expect(built.allowedChunkIds).toEqual(
        expect.arrayContaining(['on-topic', 'pmid-31234567', 'rec-1']),
      );
      // Off-topic passages and studies without an abstract are not evidence.
      expect(built.allowedChunkIds).not.toContain('off-topic');
      expect(built.allowedChunkIds).not.toContain('pmid-999');
      expect(
        built.citationCatalog.find((c) => c.chunkId === 'pmid-31234567'),
      ).toEqual(
        expect.objectContaining({
          sourceKind: 'public_literature',
          url: 'https://pubmed.ncbi.nlm.nih.gov/31234567/',
        }),
      );
      expect(built.offered).toEqual({
        libraryPassages: 1,
        literatureArticles: 1,
        recordEntries: 1,
      });
      expect(built.systemPrompt).toContain('generalMedicalKnowledge');
      expect(built.systemPrompt).toContain('Never invent a source');
      expect(built.userPrompt).toContain(
        '## Published Studies (PubMed abstracts)',
      );
      expect(built.userPrompt).toContain(
        'TBI was associated with a higher risk of ischemic stroke.',
      );
      expect(built.userPrompt).toContain('only 1 closely matching passage(s)');
    });

    it('says plainly when there is nothing to cite', async () => {
      const built = await builder.build(
        request,
        createMockRetrievalResult({
          chunks: [],
          coverage: {
            searchMode: 'keyword_only',
            vectorSkipReason: 'embedding_failed',
            relevantChunkCount: 0,
            topSimilarity: 0,
            relevanceThreshold: 0.75,
            sufficient: false,
          },
        }),
        undefined,
        undefined,
        undefined,
        { mode: 'supplemented', literature: [] },
      );

      expect(built.allowedChunkIds).toEqual([]);
      expect(built.userPrompt).toContain('searched by keyword');
      expect(built.userPrompt).toContain('None available.');
    });
  });
});
