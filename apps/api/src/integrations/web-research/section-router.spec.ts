import {
  coverageLine,
  institutionsIn,
  routeWebFindings,
} from './section-router';
import type {
  WebClaim,
  WebRecord,
  WebResearchDossier,
} from './web-research.types';

function record(
  id: string,
  url: string,
  kind: WebRecord['kind'],
  claims: WebClaim[] = [],
  level: WebRecord['match']['level'] = 'strong',
  title = id,
): WebRecord {
  return {
    id,
    url,
    title,
    kind,
    snippet: null,
    summary: `${title} summary`,
    publishedAt: null,
    retrievedAt: '2026-10-20T00:00:00.000Z',
    searchProviders: [],
    queries: [],
    read: 'read',
    readNote: null,
    match: {
      level,
      confidence: 'high',
      basis: [],
      conflicts: [],
      quote: 'Jason Demery quote',
      quoteVerified: true,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims,
  };
}

const claim = (
  topic: WebClaim['topic'],
  quote: string,
  basis: WebClaim['basis'] = 'third_party',
): WebClaim => ({
  type: 'credential',
  text: quote,
  quote,
  topic,
  basis,
  from: 'page',
});

function dossier(
  records: WebRecord[],
  over: Partial<WebResearchDossier> = {},
): WebResearchDossier {
  return {
    ranAt: '2026-10-20T00:00:00.000Z',
    durationMs: 1,
    partial: false,
    partialNote: null,
    queriesPlanned: 4,
    queriesRun: 4,
    providers: [
      {
        providerId: 'gemini_grounding',
        name: 'Gemini',
        configured: true,
        requests: 4,
        failedRequests: 0,
        hits: 9,
        failures: [],
      },
    ],
    pagesRead: 1,
    pagesBlocked: [],
    candidates: [],
    records,
    registries: [],
    limitations: [],
    ...over,
  };
}

describe('institutionsIn', () => {
  it('lists each institution once and drops the next sentence’s first word', () => {
    expect(
      institutionsIn(
        'An AA from Saint Leo University, a BA from University of West Florida and a PhD from University of Florida. He teaches.',
      ),
    ).toEqual([
      'University of West Florida',
      'University of Florida',
      'Saint Leo University',
    ]);
  });
});

describe('routeWebFindings', () => {
  it('files statements under the sections they are about', () => {
    const routed = routeWebFindings(
      dossier([
        record('a', 'https://clinic.example/about', 'expert_website', [
          claim(
            'education',
            'PhD from the University of Florida',
            'subject_stated',
          ),
          claim(
            'membership',
            'Member of the National Academy of Neuropsychology',
          ),
          claim('grant', 'Funded by grant R01 NS123456'),
          claim(
            'discipline',
            'The board filed an administrative complaint',
            'allegation',
          ),
        ]),
      ]),
    );
    expect(routed.get('education')).toHaveLength(1);
    expect(routed.get('university-accreditation')?.[0].title).toContain(
      'University of Florida',
    );
    expect(routed.get('memberships')).toHaveLength(1);
    expect(routed.get('grants')).toHaveLength(1);
    const action = routed.get('board-actions')?.[0];
    expect(action?.basisLabel).toMatch(/not established|Reported/);
  });

  it('never routes a page that is not tied to the expert', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'x',
          'https://other.example/a',
          'other',
          [claim('education', 'PhD from the University of Texas')],
          'other_person',
        ),
        record(
          'y',
          'https://other.example/b',
          'other',
          [claim('education', 'PhD from the University of Ohio')],
          'weak',
        ),
      ]),
    );
    expect(routed.size).toBe(0);
  });

  it('groups certification claims by organization and does not call a directory the certifier', () => {
    const quote =
      'Board Certified by the American Board of Professional Psychology (ABPP-CN).';
    const routed = routeWebFindings(
      dossier([
        record('a', 'https://clinic.example/about', 'expert_website', [
          claim('board_certification', quote),
        ]),
        record('b', 'https://www.theaacn.org/member-directory/1', 'directory', [
          claim(
            'certification_org',
            'American Academy of Clinical Neuropsychology (AACN) member',
            'primary_source',
          ),
          claim('board_certification', quote),
        ]),
      ]),
    );
    const organizations = routed.get('certification-orgs') ?? [];
    const abpp = organizations.find((f) => f.title.includes('ABPP'));
    expect(abpp).toBeDefined();
    expect(abpp?.basis).not.toBe('primary_source');
    const aacn = organizations.find((f) => f.title.includes('AACN'));
    expect(aacn?.basis).toBe('primary_source');
  });

  it('files court pages by document type and publications by kind', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'o',
          'https://ecf.flmd.uscourts.gov/1',
          'court',
          [],
          'strong',
          'Order on motion in limine',
        ),
        record(
          'm',
          'https://ecf.flmd.uscourts.gov/2',
          'court',
          [],
          'strong',
          'Defendant’s motion to compel',
        ),
        record(
          'p',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC1/',
          'publication',
          [],
          'strong',
          'Cognitive outcomes',
        ),
      ]),
    );
    expect(routed.get('orders')?.[0].url).toBe(
      'https://ecf.flmd.uscourts.gov/1',
    );
    expect(routed.get('pleadings')?.[0].url).toBe(
      'https://ecf.flmd.uscourts.gov/2',
    );
    expect(routed.get('publications')?.[0].title).toBe('Cognitive outcomes');
  });

  it('lists companies named on pages that name the expert', () => {
    const routed = routeWebFindings(
      dossier([record('a', 'https://clinic.example/about', 'expert_website')], {
        companies: [
          {
            name: 'Neuropsychological Sciences, LLC',
            url: 'https://clinic.example/about',
            scope: 'own_page',
            quote: 'Neuropsychological Sciences, LLC, Gainesville.',
          },
        ],
      }),
    );
    expect(routed.get('corporate')?.[0].title).toBe(
      'Neuropsychological Sciences, LLC',
    );
    expect(routed.get('corporate')?.[0].basis).toBe('subject_stated');
  });
});

describe('coverageLine', () => {
  it('states a professional negative when the topic was searched', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'grants', queries: 2, hits: 14 }] }),
      'grants',
      [],
      'Jason A. Demery',
    );
    expect(line).toMatch(
      /did not establish a research grant award directly attributable to Jason A. Demery/,
    );
    expect(line).not.toMatch(/targeted web search/);
    expect(line).not.toMatch(/cannot prove/);
  });

  it('says not searched when the web run did not work or did not run', () => {
    expect(coverageLine(null, 'grants')).toMatch(/was not searched/);
    const failed = dossier([], {
      providers: [
        {
          providerId: 'g',
          name: 'G',
          configured: true,
          requests: 3,
          failedRequests: 3,
          hits: 0,
          failures: [],
        },
      ],
    });
    expect(coverageLine(failed, 'grants')).toMatch(/did not complete/);
  });

  it('mentions a blocked source only when it is material to the section', () => {
    const patents = coverageLine(
      dossier([], {
        topics: [{ topic: 'patents', queries: 1, hits: 3 }],
        pagesBlocked: [{ url: 'https://x.example', reason: 'CAPTCHA' }],
      }),
      'patents',
    );
    expect(patents).not.toMatch(/could not be read/);
    const grants = coverageLine(
      dossier([], {
        topics: [{ topic: 'grants', queries: 1, hits: 0 }],
        pagesBlocked: [
          { url: 'https://reporter.nih.gov/x', reason: 'CAPTCHA' },
        ],
      }),
      'grants',
    );
    expect(grants).toMatch(/could not be read/);
  });
});
