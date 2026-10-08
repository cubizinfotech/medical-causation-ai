import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
  ExpertResearchProviderId,
  ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { EWI_WORKFLOW_STAGES } from './investigation-stages';
import { executeInvestigationWorkflow } from './investigation-workflow';

const identity: ExpertIdentityResolution = {
  status: 'confirmed',
  identity: {
    npi: '1234567893',
    name: 'Jane Ann Smith, MD',
    credential: 'MD',
    taxonomy: 'Psychiatry & Neurology, Neurology',
    city: 'PHOENIX',
    state: 'AZ',
    url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
  },
  basis: ['name', 'practice city', 'specialty'],
  note: 'NPI 1234567893 is the only NPI Registry record that matches.',
  notes: [],
  candidates: [],
};

const excerpt =
  'Defendant moves to exclude Dr. Jane Smith under Daubert. The motion to exclude Dr. Smith is DENIED.';

function opinion(): ExpertEvidenceItem {
  return {
    sourceId: 'courtlistener',
    category: 'legal',
    title: 'Doe v. Roe (2020)',
    summary: 'Opinion with challenge language.',
    url: 'https://www.courtlistener.com/opinion/1/doe-v-roe/',
    informationStatus: 'unverified',
    raw: {
      identity: {
        name: 'Jane Smith',
        specialty: 'Neurology',
        verifiedBy: 'source_match',
      },
      documentType: 'expert_witness_case',
      caseName: 'Doe v. Roe',
      documentDate: '2020-02-03',
      challenge: {
        standard: 'daubert',
        outcome: 'not_determined',
        role: 'unclear',
        quote: null,
        basis: 'not_determined',
        excerpts: [excerpt],
        excerptSource: 'opinion_text',
      },
    },
  };
}

function result(
  sourceId: ExpertResearchProviderId,
  items: ExpertEvidenceItem[] = [],
  extra: Partial<ExpertResearchSourceResult> = {},
): ExpertResearchSourceResult {
  return {
    sourceId,
    status: items.length > 0 ? 'ok' : 'no_result',
    outcome: items.length > 0 ? 'success' : 'no_result',
    access: 'public',
    message: 'checked',
    retrievedAt: '2026-10-08T00:00:00.000Z',
    items: items.map((item) => ({ ...item, identityMatch: 'matched' })),
    ...extra,
  };
}

describe('investigation workflow with live identity and rulings', () => {
  const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
    [
      'identify-expert',
      'profiles',
      'legal',
      'analyze-legal',
      'report',
    ].includes(stage.id),
  );

  it('keeps the NPI identity and only rulings quoted from the court', async () => {
    const build = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve({
        fileName: 'report.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('docx'),
        format: 'docx' as const,
        templateId: 'ewi/investigation-report',
        templateVersion: '2.1.0',
      });
    });
    const queries: Array<{ npi?: string }> = [];
    const readChallengeRulings = jest.fn(() =>
      Promise.resolve([
        {
          id: 'c1',
          role: 'challenged_expert',
          outcome: 'admitted',
          quote: 'The motion to exclude Dr. Smith is DENIED.',
        },
      ]),
    );
    const outcome = await executeInvestigationWorkflow(
      {
        expertName: 'Jane Smith',
        city: 'Phoenix',
        specialty: 'Neurology',
        npi: '1234567893',
      },
      {
        stages,
        report: { build },
        retryDelayMs: 0,
        sleep: () => Promise.resolve(),
        readChallengeRulings,
        research: {
          collectProviders: (query, providerIds) => {
            queries.push(query);
            return Promise.resolve(
              providerIds.map((sourceId) =>
                sourceId === 'npi_registry'
                  ? result(sourceId, [], { identity })
                  : sourceId === 'courtlistener'
                    ? result(sourceId, [opinion()])
                    : result(sourceId),
              ),
            );
          },
        },
      },
    );

    expect(queries.every((query) => query.npi === '1234567893')).toBe(true);
    expect(outcome.result.npi).toBe('1234567893');
    expect(outcome.result.identity).toEqual(identity);
    expect(readChallengeRulings).toHaveBeenCalledWith(
      expect.objectContaining({ surname: 'smith' }),
    );
    const [challenge] = outcome.result.legalResearch.challenges;
    expect(challenge.challenge).toMatchObject({
      outcome: 'admitted',
      basis: 'court_text',
      quote: 'The motion to exclude Dr. Smith is DENIED.',
    });
    // The reading is stored on the evidence so a reload shows the same result.
    expect(
      (outcome.result.evidence[0].raw?.challenge as { outcome: string })
        .outcome,
    ).toBe('admitted');
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ identity }));
  });

  it('leaves rulings undetermined when no model reads them', async () => {
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
        research: {
          collectProviders: (_query, providerIds) =>
            Promise.resolve(
              providerIds.map((sourceId) =>
                sourceId === 'courtlistener'
                  ? result(sourceId, [opinion()])
                  : result(sourceId),
              ),
            ),
        },
      },
    );
    expect(outcome.result.identity).toMatchObject({ status: 'unavailable' });
    expect(outcome.result.legalResearch.challenges[0].challenge.outcome).toBe(
      'not_determined',
    );
  });
});
