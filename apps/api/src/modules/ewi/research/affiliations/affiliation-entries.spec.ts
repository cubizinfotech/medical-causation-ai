import type { CvClaim } from '../../cv/cv.types';
import {
  affiliationEntriesFromClaims,
  classifyRelationshipType,
} from './affiliation-entries';

function claim(
  partial: Partial<CvClaim> & Pick<CvClaim, 'category' | 'statement'>,
): CvClaim {
  return {
    id: partial.id ?? 'c1',
    category: partial.category,
    statement: partial.statement,
    details: partial.details ?? {},
    page: partial.page ?? 1,
    quote: partial.quote ?? partial.statement,
  };
}

describe('affiliation entry extraction', () => {
  it('extracts faculty appointment claims', () => {
    const entries = affiliationEntriesFromClaims([
      claim({
        id: 'a1',
        category: 'appointment',
        statement:
          'Clinical Assistant Professor, University of South Florida, 2018-present',
        details: {
          title: 'Clinical Assistant Professor',
          institution: 'University of South Florida',
          year: '2018-present',
        },
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].class).toBe('appointment');
    expect(['clinical_appointment', 'faculty_appointment']).toContain(
      entries[0].relationshipType,
    );
    expect(entries[0].timeframe).toBe('current');
    expect(entries[0].institution).toMatch(/South Florida/i);
  });

  it('classifies practicum as training, not appointment', () => {
    const c = claim({
      category: 'training',
      statement:
        'Clinical Practicum, Tampa General Hospital, site supervisor placement',
      details: { institution: 'Tampa General Hospital', title: 'Practicum' },
    });
    expect(classifyRelationshipType(c)).toBe('practicum_placement');
    const entries = affiliationEntriesFromClaims([c]);
    expect(entries[0].class).toBe('training');
  });

  it('classifies internship / residency as training', () => {
    expect(
      classifyRelationshipType(
        claim({
          category: 'training',
          statement: 'Predoctoral Internship, VA Medical Center, 2010',
          details: { institution: 'VA Medical Center' },
        }),
      ),
    ).toBe('internship');
    expect(
      classifyRelationshipType(
        claim({
          category: 'education',
          statement: 'Neuropsychology Fellowship, Mayo Clinic, 2012',
          details: { institution: 'Mayo Clinic' },
        }),
      ),
    ).toBe('residency_fellowship_training');
  });

  it('rejects membership, degree-only, and publisher lines', () => {
    expect(
      affiliationEntriesFromClaims([
        claim({
          category: 'membership',
          statement: 'Member, American Psychological Association',
        }),
        claim({
          category: 'education',
          statement: 'Ph.D., University of Florida, 2005',
          details: { degree: 'Ph.D.', institution: 'University of Florida' },
        }),
        claim({
          category: 'appointment',
          statement: 'Editorial board, Journal of Neuropsychology, Wiley',
          details: { title: 'Editorial board', institution: 'Wiley' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('prefers training when training cues dominate an appointment-like title', () => {
    const entries = affiliationEntriesFromClaims([
      claim({
        category: 'appointment',
        statement:
          'Internship supervisor listing at Nova Southeastern University practicum site',
        details: {
          title: 'Internship supervisor',
          institution: 'Nova Southeastern University',
        },
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].class).toBe('training');
  });
});
