import { parsePersonName } from '../expert-research/live/person-name';
import {
  claimIdentifiesDifferentPerson,
  corporateClaimMatchesSource,
  gateSubjectClaim,
  isAmbiguityWorthReporting,
  isMultiPersonRegistryDump,
  isUnreadAdverseClaim,
  matchAllowsSubjectFinding,
  officeClaimNearSubject,
} from './evidence-gate';
import type { WebClaim, WebRecord } from './web-research.types';

const subject = {
  name: parsePersonName('Nicole Graham')!,
  city: 'Florida',
  specialty: 'neuropsychology',
};

function claim(
  topic: WebClaim['topic'],
  text: string,
  quote = text,
): WebClaim {
  return {
    type: topic === 'criminal' ? 'allegation' : 'credential',
    text,
    quote,
    topic,
    basis: 'third_party',
    from: 'snippet',
  };
}

function record(
  over: Partial<WebRecord> & Pick<WebRecord, 'url' | 'match'>,
): WebRecord {
  return {
    id: 'r1',
    title: 'Page',
    kind: 'justia',
    snippet: null,
    summary: '',
    publishedAt: null,
    retrievedAt: '2026-11-04T00:00:00.000Z',
    searchProviders: ['test'],
    queries: [],
    read: 'snippet_only',
    readNote: null,
    candidateId: null,
    claims: [],
    ...over,
  };
}

describe('evidence-gate', () => {
  it('requires strong identity for subject findings', () => {
    expect(matchAllowsSubjectFinding('strong')).toBe(true);
    expect(matchAllowsSubjectFinding('possible')).toBe(false);
    expect(matchAllowsSubjectFinding('weak')).toBe(false);
  });

  it('rejects claims that admit a different person', () => {
    expect(
      claimIdentifiesDifferentPerson(
        'Court records for a Nicole E. Graham pertain to a different individual in Wisconsin',
      ),
    ).toBe(true);
  });

  it('rejects unread adverse snippets for subject criminal sections', () => {
    const c = claim(
      'criminal',
      'Criminal record: conviction for a different individual',
    );
    const r = record({
      url: 'https://law.justia.com/cases/example',
      match: {
        level: 'possible',
        confidence: 'low',
        basis: [],
        conflicts: [],
        quote: null,
        quoteVerified: false,
        classifiedBy: 'rules',
      },
      read: 'snippet_only',
    });
    expect(isUnreadAdverseClaim(c, r)).toBe(true);
    expect(
      gateSubjectClaim({ claim: c, record: r, sectionId: 'criminal' }).accept,
    ).toBe(false);
  });

  it('detects multi-person registry dumps', () => {
    const dump = `
      Archer Vanessa L. Psychologist PY5597 11301 South Dixie Hwy
      Arias Alejandro J. Psychologist PY6085 PO Box 278455
      Coffman Michael C. Psychologist PY9832 5720 5th Ave N.
      Coffman Theodora P. Psychologist PY9999 100 Main St
    `;
    expect(isMultiPersonRegistryDump(dump)).toBe(true);
  });

  it('requires office claims near the subject name', () => {
    const c = claim(
      'office',
      'Office or address: 11301 South Dixie Hwy',
      '11301 South Dixie Hwy',
    );
    expect(
      officeClaimNearSubject(
        c,
        'Coffman Michael C. Psychologist PY9832 11301 South Dixie Hwy. Nicole Graham is listed elsewhere.',
        subject,
      ),
    ).toBe(false);
    expect(
      officeClaimNearSubject(
        c,
        'Nicole Graham, Ph.D. practices at 11301 South Dixie Hwy, Fort Lauderdale.',
        subject,
      ),
    ).toBe(true);
  });

  it('rejects corporate claims whose URL names a different entity', () => {
    expect(
      corporateClaimMatchesSource({
        companyName: 'Nicole Graham, Ph.D., P.A.',
        url: 'https://usbusinesslookup.com/company/fl/gainesville/acha-merrillwood-i-inc-n19000010827',
        quote: 'Supports the corporate filing date for Nicole Graham, Ph.D., P.A.',
      }),
    ).toBe(false);
    expect(
      corporateClaimMatchesSource({
        companyName: 'Nicole Graham, Ph.D., P.A.',
        url: 'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?SearchTerm=NICOLE%20GRAHAM',
        pageText: 'Nicole Graham, Ph.D., P.A. Fort Lauderdale',
      }),
    ).toBe(true);
  });

  it('drops unrelated different-first-name obituaries from §39', () => {
    expect(
      isAmbiguityWorthReporting({
        label: 'Another person: Ryleigh Graham, New York',
        basis: [
          'The page names "Ryleigh Graham", a different first name from Nicole Graham.',
        ],
        records: [
          {
            title: 'Ryleigh Graham Obituary',
            summary: 'Obituary for Ryleigh Graham of Oswego, NY',
            url: 'https://news.example/obituary',
            kind: 'news',
            match: {
              level: 'other_person',
              confidence: 'low',
              basis: [],
              conflicts: [],
              quote: null,
              quoteVerified: false,
              classifiedBy: 'rules',
            },
          },
        ],
        subjectSpecialty: 'neuropsychology',
      }),
    ).toBe(false);
  });
});
