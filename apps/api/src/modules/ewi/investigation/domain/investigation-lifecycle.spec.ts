import {
  InvalidInvestigationTransitionError,
  assertInvestigationTransition,
  toStorableFinding,
} from './investigation-lifecycle';

describe('investigation lifecycle', () => {
  it('allows pending to running and running to a terminal status', () => {
    expect(() =>
      assertInvestigationTransition('pending', 'running'),
    ).not.toThrow();
    expect(() =>
      assertInvestigationTransition('running', 'completed'),
    ).not.toThrow();
    expect(() =>
      assertInvestigationTransition('running', 'failed'),
    ).not.toThrow();
    expect(() =>
      assertInvestigationTransition('pending', 'cancelled'),
    ).not.toThrow();
    expect(() =>
      assertInvestigationTransition('running', 'cancelled'),
    ).not.toThrow();
  });

  it('rejects skipping pending or leaving a terminal status', () => {
    expect(() => assertInvestigationTransition('pending', 'completed')).toThrow(
      InvalidInvestigationTransitionError,
    );
    expect(() => assertInvestigationTransition('completed', 'running')).toThrow(
      InvalidInvestigationTransitionError,
    );
    expect(() => assertInvestigationTransition('cancelled', 'running')).toThrow(
      InvalidInvestigationTransitionError,
    );
  });

  it('stores LexisNexis items as metadata and a link only', () => {
    const stored = toStorableFinding({
      title: 'Smith v. Example',
      summary: 'Full opinion text that must not be retained.',
      url: 'https://advance.lexis.com/example',
      sourceType: 'legal',
      provider: 'LexisNexis',
      publishedAt: new Date('2020-01-02'),
    });

    expect(stored.restricted).toBe(true);
    expect(stored.summary).toBeNull();
    expect(stored.url).toBe('https://advance.lexis.com/example');
    expect(stored.title).toBe('Smith v. Example');
    expect(stored.notes).toMatch(/does not permit storing content/i);
  });

  it('keeps a summary when the source is not restricted', () => {
    const stored = toStorableFinding({
      title: 'Directory listing',
      summary: 'Public directory profile.',
      url: 'https://example.test/profile',
      sourceType: 'directory',
      provider: 'mock',
    });

    expect(stored.restricted).toBe(false);
    expect(stored.summary).toBe('Public directory profile.');
  });
});
