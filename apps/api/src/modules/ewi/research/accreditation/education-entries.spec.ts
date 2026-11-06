import type { CvClaim } from '../../cv/cv.types';
import {
  apaNotApplicable,
  apaProgramMayApply,
  educationEntriesFromClaims,
} from './education-entries';

function claim(
  partial: Partial<CvClaim> & Pick<CvClaim, 'statement'>,
): CvClaim {
  return {
    id: partial.id ?? 'c1',
    category: partial.category ?? 'education',
    statement: partial.statement,
    details: partial.details ?? {},
    page: partial.page ?? 1,
    quote: partial.quote ?? partial.statement,
  };
}

describe('educationEntriesFromClaims', () => {
  it('builds one doctoral entry from a CV claim', () => {
    const entries = educationEntriesFromClaims([
      claim({
        statement:
          'Ph.D., Clinical Psychology, University of South Florida, 2008',
        details: {
          institution: 'University of South Florida',
          degree: 'Ph.D.',
          year: '2008',
        },
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].institution).toBe('University of South Florida');
    expect(entries[0].degreeKind).toBe('doctoral');
    expect(entries[0].graduationYear).toBe(2008);
    expect(entries[0].fieldOfStudy).toMatch(/Clinical Psychology/i);
  });

  it('builds three assessments seeds for three universities', () => {
    const entries = educationEntriesFromClaims([
      claim({
        id: 'a',
        statement: 'B.A., Psychology, University of Florida, 2000',
        details: {
          institution: 'University of Florida',
          degree: 'B.A.',
          year: '2000',
        },
      }),
      claim({
        id: 'b',
        statement: 'M.A., Psychology, University of Central Florida, 2003',
        details: {
          institution: 'University of Central Florida',
          degree: 'M.A.',
          year: '2003',
        },
      }),
      claim({
        id: 'c',
        statement:
          'Ph.D., Clinical Psychology, University of South Florida, 2008',
        details: {
          institution: 'University of South Florida',
          degree: 'Ph.D.',
          year: '2008',
        },
      }),
    ]);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.institution)).toEqual([
      'University of Florida',
      'University of Central Florida',
      'University of South Florida',
    ]);
  });

  it('keeps multiple degrees at the same university', () => {
    const entries = educationEntriesFromClaims([
      claim({
        id: '1',
        statement: 'M.A., Psychology, University of South Florida, 2004',
        details: {
          institution: 'University of South Florida',
          degree: 'M.A.',
          year: '2004',
        },
      }),
      claim({
        id: '2',
        statement:
          'Ph.D., Clinical Psychology, University of South Florida, 2008',
        details: {
          institution: 'University of South Florida',
          degree: 'Ph.D.',
          year: '2008',
        },
      }),
    ]);
    expect(entries).toHaveLength(2);
  });

  it('dedupes identical institution+degree+year keys', () => {
    const entries = educationEntriesFromClaims([
      claim({
        id: '1',
        statement: 'Ph.D., University of South Florida, 2008',
        details: {
          institution: 'University of South Florida',
          degree: 'Ph.D.',
          year: '2008',
        },
      }),
      claim({
        id: '2',
        statement: 'Ph.D., University of South Florida, 2008',
        details: {
          institution: 'University of South Florida',
          degree: 'Ph.D.',
          year: '2008',
        },
      }),
    ]);
    expect(entries).toHaveLength(1);
  });

  it('marks non-psych bachelor’s as outside APA scope', () => {
    const entry = educationEntriesFromClaims([
      claim({
        statement: 'B.S., Biology, University of Florida, 1999',
        details: {
          institution: 'University of Florida',
          degree: 'B.S.',
          year: '1999',
        },
      }),
    ])[0];
    expect(apaProgramMayApply(entry, 'Clinical Psychology')).toBe(false);
    expect(apaNotApplicable(entry, 'Clinical Psychology')).toBe(true);
  });
});
