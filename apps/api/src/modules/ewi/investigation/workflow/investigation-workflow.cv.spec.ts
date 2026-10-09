import type {
  ExpertResearchProviderId,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import type { CvExtraction } from '../../cv/cv.types';
import { EWI_WORKFLOW_STAGES } from './investigation-stages';
import { executeInvestigationWorkflow } from './investigation-workflow';
import { PublicResearchCache } from './research-cache';

const extraction: CvExtraction = {
  document: {
    id: 'doc-1',
    name: 'smith-cv.pdf',
    pageCount: 2,
    unreadablePages: [],
    ocrPages: [],
  },
  status: 'completed',
  warnings: [],
  claims: [
    {
      id: 'cv-1',
      category: 'publications_count',
      statement: 'Over 120 publications',
      details: { count: 120 },
      page: 2,
      quote: 'Author of more than 120 publications',
    },
    {
      id: 'cv-2',
      category: 'publication',
      statement: 'Spine study',
      details: { title: 'Spine study title' },
      page: 2,
      quote: 'Spine study title. Spine 2012.',
    },
  ],
};

function empty(sourceId: ExpertResearchProviderId): ExpertResearchSourceResult {
  return {
    sourceId,
    status: 'no_result',
    outcome: 'no_result',
    access: 'public',
    message: 'checked',
    retrievedAt: '2026-10-09T00:00:00.000Z',
    items: [],
  };
}

describe('investigation workflow with an uploaded CV', () => {
  const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
    ['identify-expert', 'profiles', 'discrepancies', 'report'].includes(
      stage.id,
    ),
  );

  it('reads the CV as the CV source, compares it, and never caches it', async () => {
    const asked: ExpertResearchProviderId[][] = [];
    const lookupPublications = jest.fn(() =>
      Promise.resolve([
        {
          title: 'Spine study title',
          status: 'not_author' as const,
          work: {
            title: 'Spine study title',
            url: 'https://doi.org/2',
            year: 2012,
            authors: ['Ann Lee'],
          },
        },
      ]),
    );
    const readCv = jest.fn(
      (documentId: string, onProgress: (m: string) => Promise<void>) =>
        onProgress('Reading the CV (1 of 1 sections)…').then(() => extraction),
    );
    const build = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve({
        fileName: 'report.docx',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from(''),
        format: 'docx' as const,
        templateId: 'ewi/investigation-report',
        templateVersion: '2.1.0',
      });
    });
    const cache = new PublicResearchCache(60_000);
    const progress: string[] = [];

    const outcome = await executeInvestigationWorkflow(
      {
        expertName: 'Jane Smith',
        city: 'Phoenix',
        specialty: 'Neurology',
        cvDocumentId: 'doc-1',
      },
      {
        stages,
        report: { build },
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        researchCache: cache,
        readCv,
        onProgress: (update) => {
          if (update.message) progress.push(update.message);
        },
        research: {
          collectProviders: (_query, providerIds) => {
            asked.push([...providerIds]);
            return Promise.resolve(providerIds.map(empty));
          },
          lookupPublications,
        },
      },
    );

    // The CV source is answered by the uploaded CV, not by research.
    expect(asked.flat()).not.toContain('cv_profile');
    expect(readCv).toHaveBeenCalledWith('doc-1', expect.any(Function));
    expect(progress).toContain('Reading the CV (1 of 1 sections)…');
    const cvStatus = outcome.result.sourceStatuses.find(
      (status) => status.sourceId === 'cv_profile',
    );
    expect(cvStatus).toMatchObject({
      itemCount: 1,
      attemptStatus: 'completed',
    });
    expect(
      cache.get(
        { expertName: 'Jane Smith', city: 'Phoenix', specialty: 'Neurology' },
        'cv_profile',
      ),
    ).toBeNull();

    expect(lookupPublications).toHaveBeenCalledWith('Jane Smith', [
      'Spine study title',
    ]);
    const check = outcome.result.cvCheck;
    expect(check?.claims).toHaveLength(2);
    expect(
      check?.comparisons.find((row) => row.topic === 'publication')?.label,
    ).toBe('conflicting');
    // The conflict is also an inconsistency for the report and questions.
    expect(
      outcome.result.discrepancies.some((row) =>
        row.title.includes('expert is not listed as an author'),
      ),
    ).toBe(true);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ cvCheck: check }),
    );
  });

  it('has no CV check when no CV was uploaded', async () => {
    const readCv = jest.fn();
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Phoenix', specialty: 'Neurology' },
      {
        stages,
        report: {
          build: () =>
            Promise.resolve({
              fileName: 'report.docx',
              mimeType: 'application/octet-stream',
              buffer: Buffer.from(''),
              format: 'docx' as const,
              templateId: 'ewi/investigation-report',
              templateVersion: '2.1.0',
            }),
        },
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        readCv,
        research: {
          collectProviders: (_query, providerIds) =>
            Promise.resolve(providerIds.map(empty)),
        },
      },
    );
    expect(readCv).not.toHaveBeenCalled();
    expect(outcome.result.cvCheck).toBeNull();
  });
});
