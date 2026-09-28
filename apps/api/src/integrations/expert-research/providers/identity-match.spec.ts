import { assessIdentityMatch } from './identity-match';
import type { ExpertEvidenceItem } from '../expert-research.types';

const query = {
  expertName: 'Jane Smith',
  city: 'Boston',
  specialty: 'Orthopedics',
};

function item(identity?: Record<string, string>): ExpertEvidenceItem {
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
});
