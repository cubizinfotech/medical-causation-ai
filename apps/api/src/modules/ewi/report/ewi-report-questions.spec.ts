import { buildGroundedCrossExamQuestions } from './ewi-report-questions';

describe('grounded cross-examination questions', () => {
  it('does not invent questions when no finding was collected', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [],
      discrepancies: [],
    });

    expect(questions).toEqual([]);
  });

  it('reaches 100 questions that cite the collected finding and its uncertainty', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'CA License',
          summary: 'Active',
          url: 'https://example.test/license',
          informationStatus: 'unverified',
        },
      ],
    });

    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(
      questions.every((item) => item.question.includes('CA License')),
    ).toBe(true);
    expect(
      questions.some((item) =>
        /unverified|could not verify/i.test(item.question),
      ),
    ).toBe(true);
    expect(questions.map((item) => item.question).join(' ')).not.toMatch(
      /board-certified|PhD|plaintiff/i,
    );
    expect(questions[0]?.evidenceBasis).toContain(
      'https://example.test/license',
    );
  });
});
