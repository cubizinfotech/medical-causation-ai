import { CrossExamQuestionGenerator } from './cross-exam-question.generator';

describe('CrossExamQuestionGenerator', () => {
  const generator = new CrossExamQuestionGenerator();

  it('generates at least 100 questions', () => {
    const questions = generator.generate({
      expertName: 'Jane Doe',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'mock',
          category: 'license',
          title: 'CA License',
          summary: 'Active',
          simulated: true,
        },
      ],
      discrepancies: [
        {
          id: 'x',
          severity: 'medium',
          title: 'Mismatch',
          description: 'Test mismatch',
          evidenceIds: ['CA License'],
          relatedUrls: [],
        },
      ],
    });

    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(questions[0]?.question).toContain('Jane Doe');
    expect(questions.some((item) => item.question.includes('CA License'))).toBe(true);
    expect(questions.map((item) => item.question).join(' ')).not.toMatch(
      /board-certified/i,
    );
  });
});
