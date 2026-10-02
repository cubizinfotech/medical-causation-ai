import { EXPERT_RESEARCH_CATALOG } from './provider-catalog';
import {
  ExpertResearchService,
  createCatalogProviders,
} from '../expert-research.service';
import { ProviderRateLimiter } from './provider-runtime';
import type {
  ExpertEvidenceItem,
  ExpertResearchProviderId,
} from '../expert-research.types';
import {
  NO_VERIFIED_PUBLIC_EVIDENCE,
  PUBLIC_EVIDENCE_PROVIDER_IDS,
  applyPublicEvidenceGate,
  canRecordPublicEvidence,
} from './public-affiliation';
import { buildProfessionalBackgroundDossier } from '../../../modules/ewi/research/professional-background/professional-research-analyzer';

const query = {
  expertName: 'Jane Smith',
  city: 'Boston',
  specialty: 'Orthopedics',
};

function item(
  sourceId: string,
  raw: Record<string, unknown>,
  extras: Partial<ExpertEvidenceItem> = {},
): ExpertEvidenceItem {
  return {
    sourceId,
    category: 'membership',
    title: 'Public listing',
    summary: 'Collected source statement',
    url: 'https://example.local/public-source',
    retrievedAt: '2024-05-01T00:00:00.000Z',
    source: {
      providerId: sourceId as ExpertResearchProviderId,
      name: 'Public source',
      url: 'https://example.local/public-source',
      retrievedAt: '2024-05-01T00:00:00.000Z',
      access: 'public',
    },
    raw,
    ...extras,
  };
}

const supported = item('oath_keepers', {
  identity: {
    name: 'Jane Smith',
    city: 'Boston',
    specialty: 'Orthopedics',
  },
  publicSourceStatement: 'The public roster lists Jane Smith of Boston.',
  date: '2020-01-15',
});

describe('public affiliation research', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers the criminal, sheriff, POST, and Oath Keepers sources once', () => {
    const ids = EXPERT_RESEARCH_CATALOG.map((entry) => entry.id);
    for (const id of PUBLIC_EVIDENCE_PROVIDER_IDS) {
      expect(ids.filter((entry) => entry === id)).toHaveLength(1);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('records a finding only when identity and a public source statement agree', () => {
    expect(canRecordPublicEvidence(query, supported)).toBe(true);
    const gated = applyPublicEvidenceGate(query, {
      sourceId: 'oath_keepers',
      status: 'ok',
      outcome: 'success',
      access: 'public',
      retrievedAt: '2024-05-01T00:00:00.000Z',
      items: [supported],
    });
    expect(gated.items).toHaveLength(1);
    expect(gated.items[0]?.url).toBe('https://example.local/public-source');
    expect(gated.items[0]?.source?.name).toBe('Public source');
    expect(gated.items[0]?.retrievedAt).toBe('2024-05-01T00:00:00.000Z');
    expect(gated.items[0]?.raw).toMatchObject({
      publicSourceStatement: 'The public roster lists Jane Smith of Boston.',
      date: '2020-01-15',
    });
  });

  it('does not record a similar name, a name alone, or another city', () => {
    const cases = [
      item('oath_keepers', {
        identity: {
          name: 'Jane Smyth',
          city: 'Boston',
          specialty: 'Orthopedics',
        },
        publicSourceStatement: 'A similar name appears on a page.',
      }),
      item('oath_keepers', {
        identity: { name: 'Jane Smith' },
        publicSourceStatement: 'The name appears without a city or specialty.',
      }),
      item('oath_keepers', {
        identity: {
          name: 'Jane Smith',
          city: 'Chicago',
          specialty: 'Orthopedics',
        },
        publicSourceStatement: 'Jane Smith of Chicago is listed.',
      }),
    ];
    for (const candidate of cases) {
      expect(canRecordPublicEvidence(query, candidate)).toBe(false);
    }
  });

  it('does not treat an event, article, law-enforcement job, or opinion as membership', () => {
    const flags = [
      'eventAttendanceOnly',
      'generalArticle',
      'lawEnforcementEmployment',
      'politicalOpinion',
    ] as const;
    for (const flag of flags) {
      const candidate = item('constitutional_sheriff', {
        identity: {
          name: 'Jane Smith',
          city: 'Boston',
          specialty: 'Orthopedics',
        },
        publicSourceStatement: 'The page mentions Jane Smith.',
        [flag]: true,
      });
      expect(canRecordPublicEvidence(query, candidate)).toBe(false);
    }
  });

  it('drops an unsupported membership claim and records that no public evidence was found', () => {
    const gated = applyPublicEvidenceGate(query, {
      sourceId: 'oath_keepers',
      status: 'ok',
      outcome: 'success',
      access: 'public',
      retrievedAt: '2024-05-01T00:00:00.000Z',
      items: [
        item(
          'oath_keepers',
          {
            identity: { name: 'Jane Smith', city: 'Boston' },
            eventAttendanceOnly: true,
            publicSourceStatement: 'Jane Smith attended a public event.',
          },
          { title: 'Oath Keepers member' },
        ),
      ],
    });
    expect(gated.items).toEqual([]);
    expect(gated.status).toBe('no_result');
    expect(gated.message).toContain(NO_VERIFIED_PUBLIC_EVIDENCE);
    expect(gated.message?.toLowerCase()).not.toContain('is a member');

    const dossier = buildProfessionalBackgroundDossier({
      evidence: gated.items,
    });
    expect(dossier.memberships).toEqual([]);
  });

  it('does not record a POST certification without a source jurisdiction', () => {
    const candidate = item('post_records', {
      identity: {
        name: 'Jane Smith',
        city: 'Boston',
        specialty: 'Orthopedics',
      },
      publicSourceStatement: 'A national page mentions training.',
    });
    expect(canRecordPublicEvidence(query, candidate)).toBe(false);
  });

  it('does not request a POST website or invent a criminal record when nothing was retrieved', async () => {
    const fetchMock = jest.fn(() => {
      throw new Error('network must not be used');
    });
    global.fetch = fetchMock as typeof fetch;
    const service = new ExpertResearchService(
      createCatalogProviders(
        { mode: 'mock', timeoutMs: 1000, minIntervalMs: 0 },
        new ProviderRateLimiter(),
      ),
    );

    const results = await service.collect(query);
    expect(fetchMock).not.toHaveBeenCalled();

    for (const id of PUBLIC_EVIDENCE_PROVIDER_IDS) {
      const result = results.find((entry) => entry.sourceId === id);
      expect(result?.items).toEqual([]);
      expect(result?.message).toContain(NO_VERIFIED_PUBLIC_EVIDENCE);
    }

    const post = results.find((entry) => entry.sourceId === 'post_records');
    expect(post?.message).toContain('differ by state');
    expect(post?.message).toContain('no POST website was requested');
    expect(
      results.find((entry) => entry.sourceId === 'criminal_records')?.items,
    ).toEqual([]);
  });
});
