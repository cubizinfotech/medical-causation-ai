import { ExpertInvestigationRepository } from './expert-investigation.repository';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

describe('ExpertInvestigationRepository persistence rules', () => {
  it('stores a LexisNexis finding without summary text', async () => {
    const findingRows: Array<{
      summary: string | null;
      url: string | null;
      title: string;
    }> = [];
    const sourceRows: Array<{ restricted: boolean; provider: string }> = [];

    const tx = {
      researchSource: {
        create: jest.fn(
          ({ data }: { data: { restricted: boolean; provider: string } }) => {
            sourceRows.push(data);
            return { id: 'source-1' };
          },
        ),
      },
      researchFinding: {
        createMany: jest.fn(
          ({
            data,
          }: {
            data: Array<{
              summary: string | null;
              url: string | null;
              title: string;
            }>;
          }) => {
            findingRows.push(...data);
          },
        ),
      },
      discrepancy: { createMany: jest.fn() },
      crossExamQuestion: { createMany: jest.fn() },
      investigationReport: { create: jest.fn() },
      expertProfile: { update: jest.fn() },
      investigation: { update: jest.fn() },
    };

    const prisma = {
      investigation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: 'running',
          currentStage: 'report',
        }),
      },
      $transaction: (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    };

    const repo = new ExpertInvestigationRepository(prisma as never);
    const result = {
      expertName: 'Jane Smith',
      specialty: 'Orthopedics',
      evidence: [
        {
          sourceId: 'lexisnexis',
          category: 'legal',
          title: 'Smith v. Example',
          summary: 'Full opinion text that must not be retained.',
          url: 'https://advance.lexis.com/example',
        },
      ],
      discrepancies: [],
      questions: [],
      questionCount: 0,
      sourceStatuses: [],
      reportFileName: 'report.docx',
      generatedAt: '2026-09-23T00:00:00.000Z',
      disclaimer: 'test',
    } as unknown as EwiInvestigationResult;

    await repo.markCompleted('job-1', result, {
      fileName: 'report.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'reports/job-1.docx',
      byteSize: 12,
    });

    expect(sourceRows[0]?.restricted).toBe(true);
    expect(findingRows[0]?.summary).toBeNull();
    expect(findingRows[0]?.url).toBe('https://advance.lexis.com/example');
    expect(findingRows[0]?.title).toBe('Smith v. Example');
  });
});
