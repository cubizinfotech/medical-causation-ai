import {
  coverageLine,
  findingsCoverageNote,
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
    expect(routed.get('university-accreditation')).toBeUndefined();
    expect(routed.get('memberships')).toHaveLength(1);
    expect(routed.get('grants')).toHaveLength(1);
    const action = routed.get('board-actions')?.[0];
    expect(action?.basisLabel).toMatch(/not established|Reported/);
  });

  it('files a search-listed social profile under Social Media', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'li',
          'https://www.linkedin.com/company/cleveland-clinic',
          'social',
          [],
          'possible',
          'cleveland-clinic',
        ),
        record(
          'x',
          'https://x.com/ClevelandClinic',
          'social',
          [],
          'possible',
          '@ClevelandClinic',
        ),
      ]),
    );
    const social = routed.get('social') ?? [];
    expect(social.map((item) => item.url)).toEqual(
      expect.arrayContaining([
        'https://www.linkedin.com/company/cleveland-clinic',
        'https://x.com/ClevelandClinic',
      ]),
    );
    expect(social.some((item) => /institutional/i.test(item.title))).toBe(true);
    expect(
      social.some((item) => /not a personal profile/i.test(item.statement)),
    ).toBe(true);
  });

  it('does not file a court opinion as IME after the model retags kind to ime', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'retag',
          'https://www.courtlistener.com/opinion/123/smith-v-jones/',
          'ime',
          [
            claim(
              'ime',
              'The court granted a compulsory medical examination of the plaintiff',
            ),
            claim(
              'education',
              'Jason Demery earned a Ph.D. from the University of Florida',
            ),
          ],
          'strong',
          'Memorandum opinion',
        ),
      ]),
    );
    expect(routed.get('ime')).toBeUndefined();
    expect(routed.get('education')).toBeUndefined();
    expect(routed.get('orders')?.length).toBeGreaterThan(0);
  });

  it('does not file possible-match pages as the subject’s education', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'dir',
          'https://directory.example/leila',
          'directory',
          [claim('education', 'Leila Glass, PhD, UCLA')],
          'possible',
          'Leila Glass',
        ),
      ]),
    );
    expect(routed.get('education')).toBeUndefined();
  });

  it('keeps a conflicting-name directory page out of the subject’s directories', () => {
    const page = record(
      'dir',
      'https://directory.example/los-angeles-neuropsychologists',
      'directory',
      [claim('education', 'Leila Glass, PhD, earned her doctorate from UCLA')],
      'possible',
      'Los Angeles Neuropsychologists — Leah Ellenberg, Leila Glass',
    );
    page.match.conflicts = ['Leila Glass'];
    page.match.quote = 'Leila Glass, PhD, UCLA';
    const routed = routeWebFindings(dossier([page]));
    expect(routed.get('directories')).toBeUndefined();
    expect(routed.get('education')).toBeUndefined();
  });

  it('does not file a Justia or PACER page as board-certification or IME verification', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'justia-order',
          'https://law.justia.com/cases/federal/district-courts/florida/flmdce/6:2023cv02315/437798/52/',
          'justia',
          [
            claim(
              'board_certification',
              'Jason Demery, Ph.D., ABPP, a board-certified clinical neuropsychologist',
            ),
            claim(
              'ime',
              'A federal court order granted a motion to compel a compulsory medical examination',
            ),
          ],
          'possible',
          'UNITED STATES DISTRICT COURT MIDDLE DISTRICT OF FLORIDA',
        ),
        record(
          'pacer',
          'https://ecf.flmd.uscourts.gov/cgi-bin/show_public_doc?2023-02540-26-8-cv',
          'court',
          [
            claim(
              'board_certification',
              'board-certified clinical neuropsychologist',
            ),
            claim('ime', 'compulsory medical examination of a plaintiff'),
          ],
          'possible',
          'Order granting motion to compel CME',
        ),
      ]),
    );
    expect(routed.get('board-certifications')).toBeUndefined();
    expect(routed.get('certification-orgs')).toBeUndefined();
    expect(routed.get('ime')).toBeUndefined();
    expect(routed.get('licenses')).toBeUndefined();
    expect(routed.get('orders')?.length).toBeGreaterThan(0);
  });

  it('does not file a homicide research paper as a criminal record', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'paper',
          'https://www.researchgate.net/publication/281170036_Domestic_Homicide',
          'publication',
          [
            claim(
              'criminal',
              'Murderers who kill family members had more extensive criminal history',
            ),
          ],
        ),
      ]),
    );
    expect(routed.get('criminal')).toBeUndefined();
  });

  it('does not treat WebMD or a journal affiliation line as official license verification', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'webmd',
          'https://doctor.webmd.com/doctor/jason-demery',
          'profile',
          [
            claim(
              'license',
              'Dr. Jason A Demery holds an active medical license',
            ),
          ],
        ),
        record(
          'pmc',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC3830977/',
          'publication',
          [
            claim(
              'license',
              'Jason Demery, Email: jasondemery@gmail.com, Licensed Psychologist',
            ),
          ],
        ),
      ]),
    );
    expect(routed.get('licenses')).toBeUndefined();
  });

  it('does not treat a news article as official license verification', () => {
    const routed = routeWebFindings(
      dossier([
        record('news-license', 'https://news.example/demery-license', 'news', [
          claim('license', 'Dr. Demery holds Florida license PY7500'),
        ]),
      ]),
    );
    expect(routed.get('licenses')).toBeUndefined();
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
  it('does not treat a topic-level web query as proof that nothing exists', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'grants', queries: 2, hits: 14 }] }),
      'grants',
      [],
      'Jason A. Demery',
    );
    expect(line).toMatch(/dedicated search for this topic ran/i);
    expect(line).toMatch(/not proof that none exist/i);
    expect(line).not.toMatch(/did not establish/);
    expect(line).not.toMatch(/targeted web search/);
    expect(line).not.toMatch(/cannot prove/);
  });

  it('does not treat a global web run as a search of every category', () => {
    const ran = dossier([], {
      topics: [{ topic: 'identity', queries: 4, hits: 0 }],
    });
    expect(coverageLine(ran, 'grants')).toMatch(/was not searched/);
    expect(coverageLine(ran, 'grants')).not.toMatch(/did not establish/);
    expect(coverageLine(ran, 'education')).toMatch(/was not searched/);
    expect(coverageLine(dossier([], {}), 'patents')).toMatch(
      /was not searched/,
    );
    expect(coverageLine(dossier([], {}), 'patents')).not.toMatch(
      /did not establish/,
    );
  });

  it('lets a dedicated empty search speak without a "did not establish" prefix', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'license', queries: 1, hits: 0 }] }),
      'licenses',
      [
        'NPI Registry (NPPES) was searched and returned no matching record. That is not proof that none exist.',
      ],
    );
    expect(line).toMatch(/NPI Registry/);
    expect(line).toMatch(/returned no matching record/);
    expect(line).not.toMatch(/did not establish/);
    expect(line).not.toMatch(/included this topic/);
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

  it('labels an empty video topic as searched with no results, not unimplemented, and does not reuse other jobs', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'video', queries: 1, hits: 0 }] }),
      'videos',
    );
    expect(line).toMatch(/dedicated search for this topic ran/i);
    expect(line).toMatch(/not reused or revalidated/i);
    expect(line).not.toMatch(/not implemented/i);
    expect(line).not.toMatch(/was not searched in this investigation/i);
  });

  it('does not say social media was never searched when the social topic ran empty', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'social', queries: 1, hits: 0 }] }),
      'social',
    );
    expect(line).toMatch(/dedicated search for this topic ran/i);
    expect(line).not.toMatch(/no dedicated source/i);
    expect(line).not.toMatch(/was not searched in this investigation/i);
  });

  it('does not label a public patent search as not implemented', () => {
    const line = coverageLine(
      dossier([], { topics: [{ topic: 'patents', queries: 2, hits: 0 }] }),
      'patents',
      ['Patents is not implemented in this investigation.'],
    );
    expect(line).toMatch(/dedicated search for this topic ran/i);
    expect(line).toMatch(/public web search for patents/i);
    expect(line).toMatch(/Official USPTO verification/i);
    expect(line).not.toMatch(/not implemented/i);
  });

  it('records when a planned category was dropped by the query budget', () => {
    const line = coverageLine(
      dossier([], {
        topics: [{ topic: 'identity', queries: 4, hits: 1 }],
        omittedTopics: [{ topic: 'patents', reason: 'budget' }],
      }),
      'patents',
    );
    expect(line).toMatch(/query budget or time limit/i);
    expect(line).not.toMatch(/not implemented/i);
  });

  it('files a Google Patents page under patents even without a claim sentence', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'patent',
          'https://patents.google.com/patent/US1234567',
          'other',
          [],
          'strong',
          'US1234567 — Demery apparatus',
        ),
      ]),
    );
    expect(routed.get('patents')?.[0].url).toContain('patents.google.com');
  });

  it('files a YouTube page under videos even without a claim sentence', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'yt',
          'https://www.youtube.com/watch?v=dQPVnCi9EyQ',
          'video',
          [],
          'strong',
          'State Expert Dr. Jason Demery testimony',
        ),
      ]),
    );
    expect(routed.get('videos')?.[0].url).toContain('youtube.com');
  });

  it('files an expert-directory listing under directories', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'ei',
          'https://www.expertinstitute.com/experts/jason-demery',
          'directory',
          [],
          'strong',
          'Jason Demery, PhD',
        ),
      ]),
    );
    expect(routed.get('directories')?.[0].url).toContain('expertinstitute.com');
    expect(routed.get('directories')?.[0].matchLevel).toBe('strong');
  });

  it('files a possible-match court order as a possible match, not as IME', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'other-case',
          'https://www.courtlistener.com/docket/999/unrelated-v-case/',
          'court',
          [claim('ime', 'compulsory medical examination of a plaintiff')],
          'possible',
          'Order on motion in limine',
        ),
      ]),
    );
    expect(routed.get('ime')).toBeUndefined();
    expect(routed.get('orders')?.[0].matchLevel).toBe('possible');
  });

  it('files a motion that mentions a deposition as a pleading, not a deposition', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'compel',
          'https://ecf.flmd.uscourts.gov/doc1/compel-deposition',
          'court',
          [],
          'strong',
          'Motion to compel deposition of Dr. Jason A. Demery',
        ),
      ]),
    );
    expect(routed.get('pleadings')?.[0].url).toContain('compel-deposition');
    expect(routed.get('depositions')).toBeUndefined();
  });

  it('does not file a possible-match directory as the subject’s directories', () => {
    const routed = routeWebFindings(
      dossier([
        record(
          'other-dir',
          'https://www.expertinstitute.com/experts/jason-other',
          'directory',
          [],
          'possible',
          'Jason Other, PhD',
        ),
      ]),
    );
    expect(routed.get('directories')).toBeUndefined();
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

  it('does not label court-order, testimony, or accreditation public searches as unimplemented', () => {
    const topics = [
      { topic: 'court_documents', queries: 2, hits: 0 },
      { topic: 'litigation', queries: 1, hits: 0 },
      { topic: 'depositions', queries: 1, hits: 0 },
      { topic: 'university_accreditation', queries: 2, hits: 0 },
      { topic: 'news', queries: 1, hits: 0 },
    ];
    const ran = dossier([], {
      topics,
      executedQueries: [
        {
          topic: 'university_accreditation',
          query: '"University of Florida" site:chea.org',
        },
      ],
    });
    expect(
      coverageLine(ran, 'orders', [
        'Orders is not implemented in this investigation.',
      ]),
    ).toMatch(
      /dedicated search for this topic ran|public web search for court orders/i,
    );
    expect(
      coverageLine(ran, 'orders', [
        'Orders is not implemented in this investigation.',
      ]),
    ).not.toMatch(/not implemented/i);
    expect(
      coverageLine(ran, 'admissibility-challenges', [
        'Expert testimony is not implemented in this investigation.',
      ]),
    ).not.toMatch(/not implemented/i);
    expect(
      coverageLine(ran, 'university-accreditation', [
        'University accreditation is not implemented in this investigation.',
      ]),
    ).not.toMatch(/not implemented/i);
    expect(
      coverageLine(ran, 'news', [
        'News is not implemented in this investigation.',
      ]),
    ).not.toMatch(/not implemented/i);
  });

  it('distinguishes lawsuit coverage from a comprehensive search claim', () => {
    const litigationRan = dossier([], {
      topics: [{ topic: 'litigation', queries: 1, hits: 0 }],
    });
    expect(coverageLine(litigationRan, 'lawsuits')).toMatch(
      /No relevant records identified/,
    );
    expect(coverageLine(litigationRan, 'lawsuits')).not.toMatch(
      /was not searched/,
    );
    expect(coverageLine(litigationRan, 'lawsuits')).toMatch(
      /not a comprehensive malpractice or lawsuit search/,
    );
    const criminalRan = dossier([], {
      topics: [{ topic: 'criminal', queries: 1, hits: 0 }],
    });
    expect(coverageLine(criminalRan, 'criminal')).toMatch(
      /Dedicated criminal-record databases were not queried/,
    );
    expect(coverageLine(criminalRan, 'criminal')).toMatch(
      /not a comprehensive criminal-records search/,
    );
    const identityOnly = dossier([], {
      topics: [{ topic: 'identity', queries: 1, hits: 1 }],
    });
    expect(coverageLine(identityOnly, 'lawsuits')).toMatch(/was not searched/);
    expect(coverageLine(identityOnly, 'lawsuits')).not.toMatch(
      /No relevant records identified/,
    );
  });

  it('keeps not-searched only when the topic was not queried', () => {
    const globalOnly = dossier([], {
      topics: [{ topic: 'identity', queries: 2, hits: 1 }],
    });
    expect(coverageLine(globalOnly, 'education')).toMatch(/was not searched/);
    expect(findingsCoverageNote(globalOnly, 'education')).toMatch(
      /general web search/,
    );
    expect(
      findingsCoverageNote(
        dossier([], { topics: [{ topic: 'education', queries: 1, hits: 0 }] }),
        'education',
      ),
    ).toBeNull();
  });
});
