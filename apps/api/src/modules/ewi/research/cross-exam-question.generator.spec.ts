import { CrossExamQuestionGenerator } from './cross-exam-question.generator';

describe('CrossExamQuestionGenerator', () => {
  const generator = new CrossExamQuestionGenerator();

  it('builds specific questions from the findings and does not pad to a count', () => {
    const questions = generator.generate({
      expertName: 'Jane Doe',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'CA License',
          summary:
            'California physician license A12345 is listed as active since 2009.',
          url: 'https://example.test/license',
          informationStatus: 'verified',
          identityMatch: 'matched',
        },
      ],
      discrepancies: [
        {
          id: 'x',
          severity: 'medium',
          title: 'Mismatch',
          description:
            'The CV says the license was issued in 2005 but the state record says 2009.',
          evidenceIds: ['CA License'],
          relatedUrls: ['https://example.test/license'],
          label: 'conflicting',
          field: 'license',
          previousValue: null,
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: 'CV page 2',
          supportingSource: 'California DCA',
          priority: 1,
          sources: [],
        },
      ],
    });

    expect(questions).toHaveLength(2);
    expect(questions.map((item) => item.question).join(' ')).toMatch(/A12345/);
    expect(questions.map((item) => item.question).join(' ')).toMatch(/2005/);
    expect(questions.every((item) => (item.sources ?? []).length > 0)).toBe(
      true,
    );
    expect(questions.every((item) => (item.evidenceIds ?? []).length > 0)).toBe(
      true,
    );
    expect(
      questions.find((item) => item.question.includes('2005'))?.basisKind,
    ).toBe('inconsistency');
    expect(
      questions
        .find((item) => item.question.includes('2005'))
        ?.sources?.map((source) => source.name),
    ).toEqual(expect.arrayContaining(['California DCA', 'CV page 2']));
    expect(questions.map((item) => item.question).join(' ')).not.toMatch(
      /board-certified/i,
    );
  });
});
