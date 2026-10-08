import { assessIdentityMatch } from './identity-match';
import type { ExpertEvidenceItem } from '../expert-research.types';

const query = {
  expertName: 'Jane Smith',
  city: 'Boston',
  specialty: 'Orthopedics',
};

function item(identity?: Record<string, string | boolean>): ExpertEvidenceItem {
  return {
    sourceId: 'web_search',
    category: 'profile',
    title: 'Listing',
    summary: 'fixture',
    raw: identity ? { identity } : { fixture: true },
  };
}

describe('expert identity matching', () => {
  it('matches only when the name and city or specialty agree', () => {
    expect(
      assessIdentityMatch(
        query,
        item({
          name: 'Jane Smith',
          city: 'Boston',
          specialty: 'Orthopedics',
        }),
      ),
    ).toBe('matched');
  });

  it('does not treat the same name in another city as the same expert', () => {
    expect(
      assessIdentityMatch(
        query,
        item({
          name: 'Jane Smith',
          city: 'Chicago',
          specialty: 'Orthopedics',
        }),
      ),
    ).toBe('uncertain');
  });

  it('does not match a name that has no city or specialty', () => {
    expect(assessIdentityMatch(query, item({ name: 'Jane Smith' }))).toBe(
      'uncertain',
    );
    expect(assessIdentityMatch(query, item())).toBe('uncertain');
  });

  it('accepts name, city, and specialty written differently', () => {
    expect(
      assessIdentityMatch(
        query,
        item({
          name: 'Dr. Jane A. Smith, MD',
          city: 'Boston, MA',
          specialty: 'Orthopaedic Surgery',
        }),
      ),
    ).toBe('matched');
  });

  it('keeps a different middle initial or first name separate', () => {
    const withMiddle = { ...query, expertName: 'Jane A. Smith' };
    expect(
      assessIdentityMatch(
        withMiddle,
        item({ name: 'Jane B. Smith', city: 'Boston' }),
      ),
    ).toBe('uncertain');
    expect(
      assessIdentityMatch(query, item({ name: 'Joan Smith', city: 'Boston' })),
    ).toBe('uncertain');
  });

  it('trusts live-source matching but never ambiguous records', () => {
    expect(
      assessIdentityMatch(
        query,
        item({ name: 'JANE SMITH', city: 'Cambridge', verifiedBy: 'npi' }),
      ),
    ).toBe('matched');
    expect(
      assessIdentityMatch(
        query,
        item({ name: 'Jane Smith', verifiedBy: 'source_match' }),
      ),
    ).toBe('matched');
    expect(
      assessIdentityMatch(
        query,
        item({
          name: 'Jane Smith',
          city: 'Boston',
          specialty: 'Orthopedics',
          ambiguous: true,
        }),
      ),
    ).toBe('uncertain');
    expect(
      assessIdentityMatch(
        query,
        item({ name: 'Mary Jones', verifiedBy: 'npi' }),
      ),
    ).toBe('uncertain');
  });
});
