import type {
  ExpertResearchProviderId,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { researchOutcomeFor } from '@integrations/expert-research';
import {
  assertResearchPlanCoversCatalog,
  EWI_WORKFLOW_STAGES,
} from './investigation-stages';
import {
  describeResearchStage,
  executeInvestigationWorkflow,
  InvestigationCancelledError,
  isTransientResearchFailure,
} from './investigation-workflow';
import { exponentialBackoffMs, mapProviderAttempt } from './provider-attempt';
import { PublicResearchCache } from './research-cache';

describe('investigation workflow', () => {
  it('plans every catalog provider once', () => {
    expect(() => assertResearchPlanCoversCatalog()).not.toThrow();
  });

  const report = {
    build: jest.fn(() =>
      Promise.resolve({
        fileName: 'report.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('docx'),
        format: 'docx' as const,
        templateId: 'ewi/investigation-report',
        templateVersion: '1.0.0',
      }),
    ),
  };

  beforeEach(() => {
    report.build.mockClear();
  });

  it('continues when a source is unavailable and does not invent awards', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'awards', 'grants', 'questions', 'report'].includes(
        stage.id,
      ),
    );
    const calls: ExpertResearchProviderId[][] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        research: {
          collectProviders: (_query, providerIds) => {
            calls.push([...providerIds]);
            return Promise.resolve(
              providerIds.map((sourceId) =>
                emptyResult(sourceId, 'unavailable', 'Source unavailable'),
              ),
            );
          },
        },
      },
    );

    expect(calls).toEqual([
      ['grants', 'grant_results'],
      ['awards', 'military_claims'],
    ]);
    expect(outcome.result.evidence).toEqual([]);
    expect(outcome.result.summary).toMatch(/Nothing was inferred/);
    expect(outcome.result.summary).not.toMatch(
      /award recipient|received a medal/i,
    );
    // Empty findings still yield uncertainty questions grounded in empty source attempts.
    expect(outcome.result.questionCount).toBeGreaterThanOrEqual(100);
    expect(
      outcome.result.questions.every((item) => item.evidenceBasis.length > 0),
    ).toBe(true);
    expect(JSON.stringify(outcome.result.questions)).not.toMatch(
      /award recipient|received a medal/i,
    );
    expect(outcome.result.analysis.origin).toBe('deterministic');
    expect(outcome.result.summary).toMatch(/could not be verified/i);
    expect(
      outcome.result.sourceStatuses.every(
        (status) =>
          status.attemptStatus === 'unavailable' && status.checked === true,
      ),
    ).toBe(true);
  });

  it('records that LexisNexis requires authorized access and keeps no content', () => {
    const stage = EWI_WORKFLOW_STAGES.find((item) => item.id === 'legal');
    if (!stage) throw new Error('legal stage missing');
    const message = describeResearchStage(
      stage,
      [
        emptyResult('courtlistener', 'ok', 'fixture', [
          {
            sourceId: 'courtlistener',
            category: 'legal',
            title: 'Development fixture: court opinion link',
            summary: 'fixture',
            url: 'https://www.courtlistener.com/example',
            access: 'public',
            informationStatus: 'unverified',
          },
        ]),
        emptyResult('lexisnexis', 'unavailable', 'Restricted', []),
      ].map((result, index) =>
        index === 1 ? { ...result, access: 'restricted' as const } : result,
      ),
    );

    expect(message).toMatch(/lexisnexis requires authorized access/i);
    expect(message).toMatch(/restricted content was not stored/i);
    expect(message).toMatch(/Continuing|1 item/i);
  });

  it('retries a transient provider failure with exponential backoff', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'patents', 'report'].includes(stage.id),
    );
    let attempts = 0;
    const delays: number[] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        maxAttempts: 3,
        retryDelayMs: 10,
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
        research: {
          collectProviders: (_query, providerIds) => {
            attempts += 1;
            return Promise.resolve(
              providerIds.map((sourceId) => {
                if (sourceId !== 'patents') {
                  return emptyResult(sourceId, 'unavailable', 'No fixture');
                }
                if (attempts === 1) {
                  return emptyResult('patents', 'error', 'Provider timed out');
                }
                return emptyResult('patents', 'ok', 'fixture', [
                  {
                    sourceId: 'patents',
                    category: 'patent',
                    title: 'Development fixture: patent search',
                    summary: 'Development fixture only.',
                    access: 'public',
                    informationStatus: 'unverified',
                  },
                ]);
              }),
            );
          },
        },
      },
    );

    expect(attempts).toBe(2);
    expect(delays[0]).toBe(exponentialBackoffMs(10, 1));
    expect(
      isTransientResearchFailure(
        emptyResult('patents', 'error', 'Rate limited. Retry after 10ms.'),
      ),
    ).toBe(true);
    expect(outcome.result.evidence.map((item) => item.title)).toEqual([
      'Development fixture: patent search',
    ]);
    expect(
      outcome.result.sourceStatuses.find((item) => item.sourceId === 'patents')
        ?.attemptStatus,
    ).toBe('completed');
  });

  it('fails the investigation when the expert name is missing', async () => {
    await expect(
      executeInvestigationWorkflow(
        { expertName: ' ', city: 'Boston', specialty: 'Orthopedics' },
        {
          stages: EWI_WORKFLOW_STAGES.filter(
            (stage) => stage.id === 'identify-expert',
          ),
          report,
          research: { collectProviders: () => Promise.resolve([]) },
        },
      ),
    ).rejects.toThrow(/expert name, city, and medical specialty/i);
  });

  it('stops when the investigation is cancelled mid-run', async () => {
    let continueChecks = 0;
    await expect(
      executeInvestigationWorkflow(
        { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
        {
          stages: EWI_WORKFLOW_STAGES.filter((stage) =>
            ['identify-expert', 'grants', 'report'].includes(stage.id),
          ),
          report,
          retryDelayMs: 0,
          sleep: () => Promise.resolve(),
          shouldContinue: () => {
            continueChecks += 1;
            return continueChecks < 3;
          },
          research: {
            collectProviders: () =>
              Promise.resolve([
                emptyResult('grants', 'ok', 'fixture', [
                  {
                    sourceId: 'grants',
                    category: 'grant',
                    title: 'Grant',
                    summary: 'fixture',
                    access: 'public',
                    informationStatus: 'unverified',
                  },
                ]),
              ]),
          },
        },
      ),
    ).rejects.toBeInstanceOf(InvestigationCancelledError);
    expect(report.build).not.toHaveBeenCalled();
  });

  it('skips duplicate provider searches within one investigation', async () => {
    const stages = [
      ...EWI_WORKFLOW_STAGES.filter((stage) => stage.id === 'identify-expert'),
      {
        id: 'grants-a',
        label: 'Grants A',
        kind: 'research' as const,
        providers: ['grants' as const],
      },
      {
        id: 'grants-b',
        label: 'Grants B',
        kind: 'research' as const,
        providers: ['grants' as const],
      },
      ...EWI_WORKFLOW_STAGES.filter((stage) => stage.id === 'report'),
    ];
    const calls: ExpertResearchProviderId[][] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        research: {
          collectProviders: (_query, providerIds) => {
            calls.push([...providerIds]);
            return Promise.resolve(
              providerIds.map((sourceId) =>
                emptyResult(sourceId, 'ok', 'fixture', [
                  {
                    sourceId,
                    category: 'grant',
                    title: 'Grant listing',
                    summary: 'fixture',
                    access: 'public',
                    informationStatus: 'unverified',
                  },
                ]),
              ),
            );
          },
        },
      },
    );

    expect(calls).toEqual([['grants']]);
    const grantStatuses = outcome.result.sourceStatuses.filter(
      (item) => item.sourceId === 'grants',
    );
    expect(
      grantStatuses.some((item) => item.attemptStatus === 'completed'),
    ).toBe(true);
    expect(grantStatuses.some((item) => item.attemptStatus === 'skipped')).toBe(
      true,
    );
    expect(
      grantStatuses.find((item) => item.attemptStatus === 'skipped')?.checked,
    ).toBe(false);
  });

  it('resumes from a checkpoint and does not re-run completed stages', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'grants', 'report'].includes(stage.id),
    );
    const calls: ExpertResearchProviderId[][] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        checkpoint: {
          completedStageIds: ['identify-expert', 'grants'],
          sourceResults: [
            emptyResult('grants', 'ok', 'fixture', [
              {
                sourceId: 'grants',
                category: 'grant',
                title: 'Cached grant',
                summary: 'from checkpoint',
                access: 'public',
                informationStatus: 'unverified',
              },
            ]),
          ],
          evidence: [
            {
              sourceId: 'grants',
              category: 'grant',
              title: 'Cached grant',
              summary: 'from checkpoint',
              access: 'public',
              informationStatus: 'unverified',
              identityMatch: 'matched',
            },
          ],
          stageNotes: [{ label: 'Research grants', message: 'Resumed' }],
        },
        research: {
          collectProviders: (_query, providerIds) => {
            calls.push([...providerIds]);
            return Promise.resolve(
              providerIds.map((sourceId) =>
                emptyResult(sourceId, 'ok', 'should not run'),
              ),
            );
          },
        },
      },
    );

    expect(calls).toEqual([]);
    expect(outcome.result.evidence.map((item) => item.title)).toEqual([
      'Cached grant',
    ]);
    expect(report.build).toHaveBeenCalled();
  });

  it('completes with legal, presence, and financial analysis stages', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      [
        'identify-expert',
        'analyze-legal',
        'analyze-presence',
        'analyze-financial',
        'summary',
        'questions',
        'report',
      ].includes(stage.id),
    );
    const progress: string[] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        research: { collectProviders: () => Promise.resolve([]) },
        onProgress: (update) => {
          progress.push(update.step);
        },
      },
    );

    expect(progress).toEqual(
      expect.arrayContaining([
        'analyze-legal',
        'analyze-presence',
        'analyze-financial',
        'summary',
        'questions',
        'report',
      ]),
    );
    expect(outcome.result.legalResearch).toBeDefined();
    expect(outcome.result.onlinePresence).toBeDefined();
    expect(outcome.result.professionalBackground).toBeDefined();
    expect(report.build).toHaveBeenCalled();
  });

  it('marks restricted providers without treating them as completed checks of public content', () => {
    const attempt = mapProviderAttempt({
      ...emptyResult('lexisnexis', 'unavailable', 'Authorized access required'),
      access: 'restricted',
      outcome: 'restricted',
    });
    expect(attempt.attemptStatus).toBe('restricted');
    expect(attempt.disposition).toBe('paid_access');
    expect(attempt.checked).toBe(true);
  });

  it('caches safe public results and avoids a second provider call', async () => {
    const cache = new PublicResearchCache(60_000);
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'patents', 'report'].includes(stage.id),
    );
    let calls = 0;
    const research = {
      collectProviders: (
        _query: unknown,
        providerIds: readonly ExpertResearchProviderId[],
      ) => {
        calls += 1;
        return Promise.resolve(
          providerIds.map((sourceId) =>
            emptyResult(sourceId, 'ok', 'fixture', [
              {
                sourceId,
                category: 'patent',
                title: 'Patent',
                summary: 'fixture',
                access: 'public',
                informationStatus: 'unverified',
              },
            ]),
          ),
        );
      },
    };

    await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        research,
        researchCache: cache,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
      },
    );
    await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', city: 'Boston', specialty: 'Orthopedics' },
      {
        stages,
        report,
        research,
        researchCache: cache,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
      },
    );

    expect(calls).toBe(1);
  });
});

function emptyResult(
  sourceId: ExpertResearchProviderId,
  status: ExpertResearchSourceResult['status'],
  message: string,
  items: ExpertResearchSourceResult['items'] = [],
): ExpertResearchSourceResult {
  return {
    sourceId,
    status,
    outcome: researchOutcomeFor({
      status,
      access: 'public',
      message,
      itemCount: items.length,
    }),
    access: 'public',
    message,
    retrievedAt: '2026-09-23T00:00:00.000Z',
    items,
  };
}
