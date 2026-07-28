import { ContextBuilder } from '../builders/context.builder';
import type { RetrievedChunk } from '../types';
import { KNOWLEDGE_SOURCE_TYPES } from '../constants';

function makeChunk(
  overrides: Partial<RetrievedChunk> & { text: string; score: number },
): RetrievedChunk {
  const base = {
    chunkId: overrides.chunkId ?? 'doc:0',
    documentId: overrides.documentId ?? 'doc-uuid',
    knowledgeDocumentId: overrides.knowledgeDocumentId ?? 'kb-1',
    documentTitle: overrides.documentTitle ?? 'AMA Guides',
    text: overrides.text,
    chunkIndex: overrides.chunkIndex ?? 0,
    totalChunks: overrides.totalChunks ?? 10,
    pageNumber: overrides.pageNumber ?? 42,
    section: overrides.section ?? null,
    category: overrides.category ?? 'medical_book',
    subCategory: overrides.subCategory ?? null,
    sourceFile: overrides.sourceFile ?? 'books/ama.pdf',
    sourceType: KNOWLEDGE_SOURCE_TYPES.INTERNAL_KB,
    vectorScore: overrides.vectorScore ?? overrides.score,
    keywordScore: overrides.keywordScore ?? 0,
    combinedScore: overrides.combinedScore ?? overrides.score,
  };

  return {
    ...base,
    citation: {
      documentName: base.documentTitle,
      pageNumber: base.pageNumber,
      chunkNumber: base.chunkIndex + 1,
      category: base.category,
      subCategory: base.subCategory,
      similarityScore: base.combinedScore,
      citationText: `[Source: ${base.documentTitle}, p. ${base.pageNumber}, chunk ${base.chunkIndex + 1}]`,
      sourceFile: base.sourceFile,
      knowledgeDocumentId: base.knowledgeDocumentId,
    },
  };
}

describe('ContextBuilder', () => {
  const builder = new ContextBuilder();

  it('should remove duplicate chunks and respect token limits', () => {
    const chunks = [
      makeChunk({
        text: 'Traumatic brain injury may increase stroke risk.',
        score: 0.9,
      }),
      makeChunk({
        text: 'Traumatic brain injury may increase stroke risk.',
        score: 0.8,
        chunkId: 'doc:1',
        chunkIndex: 1,
      }),
      makeChunk({
        text: 'Additional evidence on cerebrovascular outcomes after mTBI.',
        score: 0.7,
        chunkId: 'doc:2',
        chunkIndex: 2,
      }),
    ];

    const context = builder.build(chunks, 200);

    expect(context.chunkCount).toBe(2);
    expect(context.citations[0].documentName).toBe('AMA Guides');
    expect(context.citations[0].pageNumber).toBe(42);
    expect(context.contextText).toContain('Evidence 1');
  });
});
