import type {
  ExpertResearchProviderId,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { EWI_WORKFLOW_STAGES } from './investigation-stages';
import {
  describeResearchStage,
  executeInvestigationWorkflow,
  isTransientResearchFailure,
} from './investigation-workflow';

describe('investigation workflow', () => {
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

  it('continues when a source is unavailable and does not invent awards', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'awards', 'grants', 'questions', 'report'].includes(
        stage.id,
      ),
    );
    const calls: ExpertResearchProviderId[][] = [];
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', specialty: 'Orthopedics' },
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

    expect(calls).toEqual([['grants']]);
    expect(outcome.result.evidence).toEqual([]);
    expect(outcome.result.summary).toMatch(/Nothing was inferred/);
    expect(outcome.result.summary).not.toMatch(
      /award recipient|received a medal/i,
    );
    expect(outcome.result.questionCount).toBe(0);
    expect(outcome.result.analysis.origin).toBe('deterministic');
    expect(outcome.result.summary).toMatch(/could not be verified/i);
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

  it('retries a transient provider failure and then keeps the successful result', async () => {
    const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
      ['identify-expert', 'patents', 'report'].includes(stage.id),
    );
    let attempts = 0;
    const outcome = await executeInvestigationWorkflow(
      { expertName: 'Jane Smith', specialty: 'Orthopedics' },
      {
        stages,
        report,
        maxAttempts: 3,
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        research: {
          collectProviders: () => {
            attempts += 1;
            if (attempts === 1) {
              return Promise.resolve([
                emptyResult('patents', 'error', 'Provider timed out'),
              ]);
            }
            return Promise.resolve([
              emptyResult('patents', 'ok', 'fixture', [
                {
                  sourceId: 'patents',
                  category: 'patent',
                  title: 'Development fixture: patent search',
                  summary: 'Development fixture only.',
                  access: 'public',
                  informationStatus: 'unverified',
                },
              ]),
            ]);
          },
        },
      },
    );

    expect(attempts).toBe(2);
    expect(
      isTransientResearchFailure(
        emptyResult('patents', 'error', 'Rate limited. Retry after 10ms.'),
      ),
    ).toBe(true);
    expect(outcome.result.evidence.map((item) => item.title)).toEqual([
      'Development fixture: patent search',
    ]);
  });

  it('fails the investigation when the expert name is missing', async () => {
    await expect(
      executeInvestigationWorkflow(
        { expertName: ' ', specialty: 'Orthopedics' },
        {
          stages: EWI_WORKFLOW_STAGES.filter(
            (stage) => stage.id === 'identify-expert',
          ),
          report,
          research: { collectProviders: () => Promise.resolve([]) },
        },
      ),
    ).rejects.toThrow(/expert name and medical specialty/i);
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
    access: 'public',
    message,
    retrievedAt: '2026-09-23T00:00:00.000Z',
    items,
  };
}
