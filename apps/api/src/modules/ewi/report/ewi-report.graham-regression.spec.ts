/**
 * Fixture regression shaped like Nicole Graham report 3.10.16 failures.
 * Names/URLs mirror the defect class without hardcoding Graham-only product rules.
 */
import { routeWebFindings } from '@integrations/web-research';
import type {
  WebClaim,
  WebRecord,
  WebResearchDossier,
} from '@integrations/web-research';
import { buildEwiReportDocument } from './ewi-report.template';
import { assessIdentity } from '../../../integrations/web-research/identity-assess';
import { parsePersonName } from '../../../integrations/expert-research/live/person-name';
import { parseCityState } from '../../../integrations/expert-research/live/location';
import { clusterRecords } from '../../../integrations/web-research/identity-clusterer';

function claim(topic: WebClaim['topic'], text: string, quote = text): WebClaim {
  return {
    type: topic === 'criminal' ? 'allegation' : 'other',
    text,
    quote,
    topic,
    basis: 'third_party',
    from: 'snippet',
  };
}

function webRecord(
  over: Partial<WebRecord> & Pick<WebRecord, 'id' | 'url' | 'kind' | 'match'>,
): WebRecord {
  return {
    title: over.title ?? 'Page',
    snippet: null,
    summary: over.summary ?? '',
    publishedAt: null,
    retrievedAt: '2026-11-04T16:39:00.000Z',
    searchProviders: ['test'],
    queries: [],
    read: over.read ?? 'read',
    readNote: null,
    candidateId: null,
    claims: over.claims ?? [],
    ...over,
  };
}

function dossier(
  records: WebRecord[],
  companies: WebResearchDossier['companies'] = [],
): WebResearchDossier {
  return {
    ranAt: '2026-11-04T16:39:00.000Z',
    durationMs: 1,
    partial: false,
    partialNote: null,
    queriesPlanned: 4,
    queriesRun: 4,
    providers: [],
    pagesRead: records.filter((r) => r.read === 'read').length,
    pagesBlocked: [],
    candidates: [],
    records,
    registries: [],
    limitations: [],
    companies,
    topics: [{ topic: 'identity', queries: 2, hits: 4 }],
  };
}

function sectionText(
  document: ReturnType<typeof buildEwiReportDocument>,
  id: string,
): string {
  return (
    document.sections
      .find((section) => section.id === id)
      ?.blocks.map((block) => block.text)
      .join('\n') ?? ''
  );
}

const strongMatch = {
  level: 'strong' as const,
  confidence: 'high' as const,
  basis: ['full name', 'specialty', 'state'],
  conflicts: [],
  quote: 'Alex Rivera',
  quoteVerified: true,
  classifiedBy: 'rules' as const,
};

const possibleMatch = {
  level: 'possible' as const,
  confidence: 'medium' as const,
  basis: ['full name', 'specialty'],
  conflicts: [],
  quote: 'Alex Rivera',
  quoteVerified: false,
  classifiedBy: 'rules' as const,
};

describe('Graham-class report regression (3.10.18)', () => {
  it('parses bare state intake as state-only so Fort Lauderdale is same-state', () => {
    expect(parseCityState('Florida')).toEqual({ city: '', state: 'FL' });
    const assessment = assessIdentity(
      {
        text: 'Dr. Alex Rivera is a clinical and forensic neuropsychologist in Fort Lauderdale, Florida.',
      },
      {
        name: parsePersonName('Alex Rivera')!,
        city: 'Florida',
        specialty: 'neuropsychology',
      },
    );
    expect(assessment.level).toBe('strong');
    expect(assessment.corroboration.city).toBe(true);
    expect(assessment.corroboration.specialty).toBe(true);
  });

  it('keeps unread Justia different-person criminal snippets out of Criminal', () => {
    const justia = webRecord({
      id: 'justia',
      url: 'https://law.justia.com/cases/florida/fifth-district-court-of-appeal/2022/5d21-2451.html',
      kind: 'justia',
      read: 'snippet_only',
      match: possibleMatch,
      claims: [
        claim(
          'criminal',
          'Criminal record: justia.com',
          'Court records for a "Alex E. Rivera" involving a criminal narcotics conviction pertain to a different individual in Wisconsin',
        ),
      ],
      summary: 'Possible criminal mention',
    });
    const routed = routeWebFindings(dossier([justia]));
    expect(routed.get('criminal')).toBeUndefined();
    const report = buildEwiReportDocument({
      expertName: 'Alex Rivera',
      city: 'Florida',
      specialty: 'neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-04T16:39:00.000Z',
      webResearch: dossier([justia]),
    });
    expect(sectionText(report, 'criminal')).not.toMatch(
      /different individual/i,
    );
    expect(sectionText(report, 'summary')).not.toMatch(/Criminal Records:/i);
  });

  it('rejects corporate claims whose URL names a different company', () => {
    const routed = routeWebFindings(
      dossier(
        [
          webRecord({
            id: 'corp',
            url: 'https://usbusinesslookup.com/company/fl/gainesville/acha-merrillwood-i-inc-n19000010827',
            kind: 'other',
            match: strongMatch,
            read: 'snippet_only',
            claims: [],
            summary: 'Business lookup',
          }),
        ],
        [
          {
            name: 'Alex Rivera, Ph.D., P.A.',
            url: 'https://usbusinesslookup.com/company/fl/gainesville/acha-merrillwood-i-inc-n19000010827',
            quote:
              'Supports the corporate filing date of September 8, 2020, for Alex Rivera, Ph.D., P.A.',
            scope: 'other_page',
          },
        ],
      ),
    );
    expect(routed.get('corporate')).toBeUndefined();
  });

  it('rejects multi-person expert-registry PDFs from Office/Location', () => {
    const registry = webRecord({
      id: 'registry',
      url: 'https://www.ca.cjis20.org/isc/pdf/Expert-Registry.pdf',
      kind: 'other',
      match: possibleMatch,
      summary:
        'Coffman, Michael C., Psy.D. PY9832 5720 5th Ave. Archer Vanessa L. Psychologist PY5597 11301 South Dixie Hwy Arias Alejandro J. Psychologist PY6085',
      claims: [
        claim(
          'office',
          'Office or address: Coffman, Michael C., Psy.D.',
          'Coffman, Michael C., Psy.D. x Archer Vanessa L. Psychologist PY5597 11301 South Dixie Hwy',
        ),
      ],
    });
    const routed = routeWebFindings(dossier([registry]));
    expect(routed.get('office-location')).toBeUndefined();
  });

  it('does not dump different-first-name obituaries into Other People', () => {
    const obit = webRecord({
      id: 'obit',
      url: 'https://news.example/ryleigh-obituary',
      kind: 'news',
      match: {
        level: 'other_person',
        confidence: 'low',
        basis: [
          'The page names "Ryleigh Rivera", a different first name from Alex Rivera.',
        ],
        conflicts: [
          'The page names "Ryleigh Rivera", a different first name from Alex Rivera.',
        ],
        quote: 'Ryleigh Rivera',
        quoteVerified: false,
        classifiedBy: 'rules',
      },
      title: 'Ryleigh Rivera Obituary (2026)',
      summary: 'Obituary for Ryleigh Rivera of Oswego, NY',
      claims: [],
    });
    const subject = {
      name: parsePersonName('Alex Rivera')!,
      city: 'Florida',
      specialty: 'neuropsychology',
    };
    const { candidates } = clusterRecords(
      [obit],
      new Map([
        ['obit', { written: 'Ryleigh Rivera', credential: null, state: 'NY' }],
      ]),
      subject,
      'Alex Rivera, neuropsychology, Florida',
    );
    expect(candidates.filter((c) => c.role === 'other')).toHaveLength(0);
    const report = buildEwiReportDocument({
      expertName: 'Alex Rivera',
      city: 'Florida',
      specialty: 'neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-04T16:39:00.000Z',
      webResearch: {
        ...dossier([obit]),
        candidates,
      },
    });
    expect(sectionText(report, 'web-research')).toMatch(
      /No meaningful alternate identity/i,
    );
    expect(sectionText(report, 'web-research')).not.toMatch(/Ryleigh Rivera/);
  });

  it('keeps distinct own-site pages as self-reported without filling Criminal/Corporate noise', () => {
    const site = webRecord({
      id: 'site',
      url: 'https://dralexrivera.example/',
      kind: 'expert_website',
      match: strongMatch,
      title: 'Alex Rivera',
      summary:
        'Dr. Alex Rivera provides neuropsychological evaluations in Fort Lauderdale, Florida.',
      claims: [
        {
          type: 'credential',
          text: 'Position or affiliation: Dr. Rivera provides neuropsychological evaluations.',
          quote:
            'Dr. Rivera provides neuropsychological evaluations for criminal and civil matters in Fort Lauderdale, Florida.',
          topic: 'employment',
          basis: 'subject_stated',
          from: 'page',
        },
      ],
    });
    const routed = routeWebFindings(dossier([site]));
    expect(routed.get('criminal')).toBeUndefined();
    expect(routed.get('background')?.length ?? 0).toBeGreaterThan(0);
    const report = buildEwiReportDocument({
      expertName: 'Alex Rivera',
      city: 'Florida',
      specialty: 'neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-04T16:39:00.000Z',
      webResearch: dossier([site]),
    });
    expect(sectionText(report, 'summary')).not.toMatch(/Criminal Records:/i);
    expect(sectionText(report, 'background')).toMatch(/Fort Lauderdale/i);
  });

  it('keeps own-site AACN / publication claims out of Cert Orgs and Publications', () => {
    const about = webRecord({
      id: 'about',
      url: 'https://dralexrivera.example/about',
      kind: 'other',
      match: strongMatch,
      title: 'About Dr. Rivera',
      summary:
        'Dr. Alex Rivera is a member of AACN and publishes in Neuropsychology Review.',
      claims: [
        {
          type: 'credential',
          text: 'Certification organization: AACN',
          quote:
            'Member of the American Academy of Clinical Neuropsychology (AACN)',
          topic: 'certification_org',
          basis: 'subject_stated',
          from: 'page',
        },
        {
          type: 'credential',
          text: 'Publication: Neuropsychology Review article',
          quote: 'Rivera, A. (2020). Sample article. Neuropsychology Review.',
          topic: 'publication',
          basis: 'subject_stated',
          from: 'page',
        },
      ],
    });
    const routed = routeWebFindings(dossier([about]), {
      expertName: 'Alex Rivera',
    });
    expect(routed.get('certification-orgs')).toBeUndefined();
    expect(routed.get('publications')).toBeUndefined();
    expect(routed.get('websites')?.length ?? 0).toBeGreaterThan(0);
    const report = buildEwiReportDocument({
      expertName: 'Alex Rivera',
      city: 'Florida',
      specialty: 'neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-05T12:00:00.000Z',
      webResearch: dossier([about]),
    });
    expect(sectionText(report, 'summary')).not.toMatch(/AACN/i);
    expect(sectionText(report, 'summary')).not.toMatch(
      /Neuropsychology Review/i,
    );
  });

  it('groups multiple paths of the same practice host under Expert Websites', () => {
    const pages = [
      '/',
      '/about',
      '/forensic-evaluations',
      '/expert-witness',
    ].map((path, i) =>
      webRecord({
        id: `site-${i}`,
        url: `https://dralexrivera.example${path}`,
        kind: 'expert_website',
        match: strongMatch,
        title: `Practice ${path}`,
        summary: 'Practice site for Dr. Alex Rivera.',
        claims: [
          {
            type: 'other',
            text: `Website page ${path}`,
            quote: 'Dr. Alex Rivera neuropsychological evaluations',
            topic: 'advertising',
            basis: 'subject_stated',
            from: 'page',
          },
        ],
      }),
    );
    const routed = routeWebFindings(dossier(pages), {
      expertName: 'Alex Rivera',
    });
    const websites = routed.get('websites') ?? [];
    expect(websites.length).toBeLessThanOrEqual(2);
    expect(websites.some((f) => /also listed/i.test(f.statement))).toBe(true);
  });

  it('excludes multi-person registry dumps from Directories without a subject row', () => {
    const registry = webRecord({
      id: 'dir-dump',
      url: 'https://www.ca.cjis20.org/isc/pdf/Expert-Registry.pdf',
      kind: 'directory',
      match: strongMatch,
      title: 'Expert Registry',
      summary:
        'Coffman, Michael C., Psy.D. PY9832 5720 5th Ave. Archer Vanessa L. Psychologist PY5597 11301 South Dixie Hwy Arias Alejandro J. Psychologist PY6085',
      claims: [],
    });
    const routed = routeWebFindings(dossier([registry]), {
      expertName: 'Alex Rivera',
    });
    expect(routed.get('directories')).toBeUndefined();
  });

  it('does not file unread RECAP notices under Pleadings', () => {
    const notice = webRecord({
      id: 'recap',
      url: 'https://www.courtlistener.com/docket/123/notice-of-filing/',
      kind: 'court',
      read: 'snippet_only',
      match: strongMatch,
      title: 'NOTICE OF FILING OF OFFICIAL TRANSCRIPT',
      summary: 'Notice of filing naming Nicole Vaccarella',
      claims: [
        claim(
          'pleading',
          'Pleading: NOTICE OF FILING OF OFFICIAL TRANSCRIPT',
          'NOTICE OF FILING OF OFFICIAL TRANSCRIPT',
        ),
      ],
    });
    const routed = routeWebFindings(dossier([notice]), {
      expertName: 'Alex Rivera',
    });
    expect(routed.get('pleadings')).toBeUndefined();
    expect(routed.get('orders')).toBeUndefined();
    expect(routed.get('depositions')).toBeUndefined();
  });

  it('routes practicum brochures to Background, not university-rules', () => {
    const brochure = webRecord({
      id: 'practicum',
      url: 'https://nova.edu/psychology/practicum-sites.pdf',
      kind: 'university',
      match: strongMatch,
      title: 'NSU Clinical Psychology Practicum Training Site Brochure',
      summary:
        'This practicum brochure lists clinical training sites for NSU students.',
      claims: [
        {
          type: 'other',
          text: 'University rules: practicum training site listing',
          quote: 'Clinical training site brochure for practicum placement',
          topic: 'university_rules',
          basis: 'third_party',
          from: 'page',
        },
      ],
    });
    const routed = routeWebFindings(dossier([brochure]), {
      expertName: 'Alex Rivera',
    });
    expect(routed.get('university-rules')).toBeUndefined();
    expect(
      routed
        .get('background')
        ?.some((f) => /practicum|training/i.test(f.title)),
    ).toBe(true);
  });

  it('splits cross-genre possible matches instead of one mega §39 bucket', () => {
    const news = webRecord({
      id: 'news',
      url: 'https://www.militarytimes.com/news/alex-rivera/',
      kind: 'news',
      match: possibleMatch,
      title: 'Alex Rivera joins unit',
      summary: 'A service member named Alex Rivera',
      claims: [],
    });
    const npi = webRecord({
      id: 'npi',
      url: 'https://npiregistry.cms.hhs.gov/provider-view/1999999999',
      kind: 'other',
      match: possibleMatch,
      title: 'NPI Registry — different Alex Rivera',
      summary: 'Alex Rivera NPI 1999999999 Ohio',
      claims: [],
    });
    const scholarly = webRecord({
      id: 'rg',
      url: 'https://www.researchgate.net/profile/Alex-Rivera-99',
      kind: 'publication',
      match: possibleMatch,
      title: 'Alex Rivera ResearchGate',
      summary: 'Publications by Alex Rivera',
      claims: [],
    });
    const subject = {
      name: parsePersonName('Alex Rivera')!,
      city: 'Florida',
      specialty: 'neuropsychology',
    };
    const { candidates } = clusterRecords(
      [news, npi, scholarly],
      new Map([
        ['news', { written: 'Alex Rivera', credential: null, state: null }],
        ['npi', { written: 'Alex Rivera', credential: 'MD', state: 'OH' }],
        ['rg', { written: 'Alex Rivera', credential: 'PhD', state: null }],
      ]),
      subject,
      'Alex Rivera, neuropsychology, Florida',
    );
    const possible = candidates.filter((c) => c.id.startsWith('cand-possible'));
    expect(possible.every((c) => c.recordIds.length <= 2)).toBe(true);
    expect(possible.some((c) => c.recordIds.length === 3)).toBe(false);
  });
});
