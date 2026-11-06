import type { CvClaim } from '../../cv/cv.types';
import { membershipEntriesFromClaims } from './membership-entries';

function claim(
  partial: Partial<CvClaim> & Pick<CvClaim, 'statement'>,
): CvClaim {
  return {
    id: partial.id ?? 'c1',
    category: partial.category ?? 'membership',
    statement: partial.statement,
    details: partial.details ?? {},
    page: partial.page ?? 1,
    quote: partial.quote ?? partial.statement,
  };
}

describe('membershipEntriesFromClaims', () => {
  it('1. extracts multiple professional memberships', () => {
    const entries = membershipEntriesFromClaims([
      claim({
        id: 'a',
        statement: 'Member, American Academy of Clinical Neuropsychology',
        details: { name: 'American Academy of Clinical Neuropsychology' },
      }),
      claim({
        id: 'b',
        statement: 'Fellow, National Academy of Neuropsychology',
        details: { name: 'National Academy of Neuropsychology' },
      }),
      claim({
        id: 'c',
        statement: 'Member, American Psychological Association',
        details: { name: 'American Psychological Association' },
      }),
    ]);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.membershipType)).toEqual(
      expect.arrayContaining(['member', 'fellow', 'member']),
    );
  });

  it('2. returns empty when CV has no memberships', () => {
    expect(
      membershipEntriesFromClaims([
        claim({
          category: 'education',
          statement: 'Ph.D., University of South Florida, 2012',
          details: { institution: 'University of South Florida' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('10. distinguishes fellow versus ordinary member', () => {
    const fellow = membershipEntriesFromClaims([
      claim({
        statement: 'Fellow of the National Academy of Neuropsychology',
        details: { name: 'National Academy of Neuropsychology' },
      }),
    ])[0];
    const member = membershipEntriesFromClaims([
      claim({
        statement: 'Member of the National Academy of Neuropsychology',
        details: { name: 'National Academy of Neuropsychology' },
      }),
    ])[0];
    expect(fellow.membershipType).toBe('fellow');
    expect(fellow.designation).toBe('Fellow');
    expect(member.membershipType).toBe('member');
  });

  it('11. rejects employment incorrectly tagged as membership', () => {
    expect(
      membershipEntriesFromClaims([
        claim({
          statement: 'Faculty appointment at University of South Florida',
          details: { name: 'University of South Florida' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('12. rejects education or training incorrectly tagged as membership', () => {
    expect(
      membershipEntriesFromClaims([
        claim({
          statement: 'Clinical psychology internship at Tampa General Hospital',
          details: { name: 'Tampa General Hospital' },
        }),
      ]),
    ).toHaveLength(0);
    expect(
      membershipEntriesFromClaims([
        claim({
          statement:
            'Postdoctoral fellowship in neuropsychology at University of Florida',
          details: { name: 'University of Florida' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('13. accepts membership claim without dates', () => {
    const entries = membershipEntriesFromClaims([
      claim({
        statement: 'Member, American Psychological Association',
        details: { name: 'APA' },
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].startYear).toBeNull();
    expect(entries[0].endYear).toBeNull();
  });

  it('14. dedupes duplicate organization names', () => {
    const entries = membershipEntriesFromClaims([
      claim({
        id: '1',
        statement: 'Member, AACN',
        details: { name: 'AACN' },
      }),
      claim({
        id: '2',
        statement: 'Member, AACN',
        details: { name: 'AACN' },
      }),
    ]);
    expect(entries).toHaveLength(1);
  });
});
