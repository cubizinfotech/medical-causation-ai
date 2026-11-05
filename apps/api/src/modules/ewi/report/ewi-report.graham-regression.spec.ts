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

function claim(
  topic: WebClaim['topic'],
  text: string,
  quote = text,
): WebClaim {
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
  over: Partial<WebRecord> &
    Pick<WebRecord, 'id' | 'url' | 'kind' | 'match'>,
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

describe('Graham-class report regression (3.10.17)', () => {
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
    expect(sectionText(report, 'criminal')).not.toMatch(/different individual/i);
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
});
