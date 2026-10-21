import type { EwiInvestigationResult } from '../investigation/jobs/ewi-investigation-job.types';
import { prepareEwiReportInput, questionsAreStale } from './ewi-report-input';
import { buildEwiReportDocument } from './ewi-report.template';

function result(
  overrides: Partial<EwiInvestigationResult> = {},
): EwiInvestigationResult {
  return {
    expertName: 'Jane Doe',
    city: 'Boston',
    specialty: 'Neurology',
    evidence: [],
    discrepancies: [],
    questions: [],
    questionCount: 0,
    sourceStatuses: [],
    reportFileName: 'ewi-jane-doe-report.pdf',
    generatedAt: '2026-10-19T12:00:00.000Z',
    disclaimer: '',
    summary: '',
    analysis: undefined as never,
    legalResearch: undefined as never,
    onlinePresence: undefined as never,
    professionalBackground: undefined as never,
    ...overrides,
  };
}

describe('prepareEwiReportInput', () => {
  it('does not treat stored OpenAlex title misses as current discrepancies', () => {
    const input = prepareEwiReportInput(
      result({
        discrepancies: [
          {
            id: 'cv-check-cvc-1',
            severity: 'medium',
            title:
              'Publication not found in the catalogs checked: Axial movements',
            description: 'OpenAlex listed no work with this title.',
            evidenceIds: [],
            relatedUrls: [],
            label: 'not_found',
            field: 'publication',
            previousValue: 'Axial movements are relatively preserved.',
            currentValue: null,
            change: null,
            cvDate: null,
            cvSource: 'Uploaded CV: cv.pdf',
            supportingSource: 'OpenAlex',
            priority: 3,
            sources: [],
          },
        ],
      }),
    );
    expect(input.discrepancies).toEqual([]);
  });

  it('rebuilds stale stored questions instead of reprinting them', () => {
    const stale = [
      {
        number: 1,
        category: 'Background and credentials',
        question: 'Is every license in finding f1 current?',
        evidenceBasis: 'collected record',
        label: 'unresolved' as const,
        sources: [],
      },
      {
        number: 2,
        category: 'Background and credentials',
        question: 'How should counsel weigh the collected record?',
        evidenceBasis: 'investigation file',
        label: 'unresolved' as const,
        sources: [],
      },
    ];
    expect(questionsAreStale(stale)).toBe(true);
    const input = prepareEwiReportInput(
      result({
        questions: stale,
        questionCount: 2,
        evidence: [
          {
            sourceId: 'npi_registry',
            category: 'license',
            title: 'CA License',
            summary:
              'California psychologist license PSY12345 is active and was issued in 2009.',
            url: 'https://example.test/license',
            informationStatus: 'verified',
            identityMatch: 'matched',
            source: {
              providerId: 'state_license',
              name: 'California DCA',
              retrievedAt: '2026-10-01T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
      }),
    );
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0].question).toContain('PSY12345');
    expect(JSON.stringify(input.questions)).not.toMatch(/finding f1/i);
    expect(input.questionsNote).toMatch(/not reprinted/i);

    const document = buildEwiReportDocument(input);
    const questionSection = document.sections.find(
      (section) => section.id === 'questions',
    );
    const printed = questionSection?.blocks.filter(
      (block) => block.style === 'item',
    );
    expect(printed).toHaveLength(input.questions.length);
    expect(questionSection?.blocks[0]?.text).toMatch(
      /^1 cross-examination question/,
    );
  });

  it('infers honest coverage for older source statuses that omitted it', () => {
    const input = prepareEwiReportInput(
      result({
        sourceStatuses: [
          {
            sourceId: 'patents',
            status: 'unavailable',
            attemptStatus: 'unavailable',
            disposition: 'unavailable',
            message:
              'Not searched. Patents live adapter is not connected. No record was retrieved.',
            itemCount: 0,
            checked: true,
          },
          {
            sourceId: 'pubmed',
            status: 'no_result',
            attemptStatus: 'completed',
            disposition: 'completed',
            message: 'PubMed returned no record.',
            itemCount: 0,
            checked: true,
          },
        ],
      }),
    );
    expect(input.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'patents',
          coverage: 'not_implemented',
          checked: false,
        }),
        expect.objectContaining({
          sourceId: 'pubmed',
          coverage: 'searched_no_results',
          checked: true,
        }),
      ]),
    );
  });

  it('does not mutate historical questions, discrepancies, or source statuses', () => {
    const stored = result({
      discrepancies: [
        {
          id: 'cv-check-cvc-1',
          severity: 'medium',
          title:
            'Publication not found in the catalogs checked: Axial movements',
          description: 'OpenAlex listed no work with this title.',
          evidenceIds: [],
          relatedUrls: [],
          label: 'not_found',
          field: 'publication',
          previousValue: 'Axial movements are relatively preserved.',
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: 'Uploaded CV: cv.pdf',
          supportingSource: 'OpenAlex',
          priority: 3,
          sources: [],
        },
      ],
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question: 'Is every license in finding f1 current?',
          evidenceBasis: 'collected record',
          label: 'unresolved',
          sources: [],
        },
      ],
      sourceStatuses: [
        {
          sourceId: 'patents',
          status: 'unavailable',
          attemptStatus: 'unavailable',
          disposition: 'unavailable',
          outcome: 'restricted',
          message: 'Not searched. Patents live adapter is not connected.',
          itemCount: 0,
          checked: true,
        },
      ],
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(input.discrepancies).toEqual([]);
    expect(input.sourceStatuses?.[0]).toMatchObject({
      coverage: 'not_implemented',
      checked: false,
    });
    expect(stored.sourceStatuses[0]?.checked).toBe(true);
    expect(stored.questions[0]?.question).toMatch(/finding f1/);
  });

  it('keeps grounded stored questions and drops ungrounded legacy ones without writing back', () => {
    const grounded = {
      number: 4,
      category: 'Background and credentials',
      question:
        'California DCA lists license PSY12345 as active. That is your current license record, correct?',
      evidenceBasis:
        'Verified. California DCA: “PSY12345” https://example.test/license',
      label: 'verified' as const,
      sources: [
        { name: 'California DCA', url: 'https://example.test/license' },
      ],
      evidenceIds: ['https://example.test/license'],
      basisKind: 'sourced_fact' as const,
    };
    const stored = result({
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question: 'Is every license in finding f1 current?',
          evidenceBasis: 'collected record',
          label: 'unresolved',
          sources: [],
        },
        grounded,
      ],
      questionCount: 2,
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0]).toMatchObject({
      number: 1,
      question: grounded.question,
    });
    expect(JSON.stringify(input.questions)).not.toMatch(/finding f1/i);
    expect(input.questionsNote).toMatch(/omitted/i);

    const document = buildEwiReportDocument(input);
    const printed = document.sections
      .find((section) => section.id === 'questions')
      ?.blocks.filter((block) => block.style === 'item');
    expect(printed).toHaveLength(1);
    expect(document.highlights?.[2]).toBe('1 cross-examination question');
  });

  it('generates grounded questions when an older result stored none', () => {
    const input = prepareEwiReportInput(
      result({
        questions: [],
        questionCount: 0,
        evidence: [
          {
            sourceId: 'state_license',
            category: 'license',
            title: 'CA License',
            summary:
              'California psychologist license PSY12345 is active and was issued in 2009.',
            url: 'https://example.test/license',
            informationStatus: 'verified',
            identityMatch: 'matched',
            source: {
              providerId: 'state_license',
              name: 'California DCA',
              retrievedAt: '2026-10-01T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
      }),
    );
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0].question).toContain('PSY12345');
    expect(input.questions[0].evidenceIds).toEqual([
      'https://example.test/license',
    ]);
  });
});
