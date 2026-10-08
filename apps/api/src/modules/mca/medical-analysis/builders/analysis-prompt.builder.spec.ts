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
});
