import {
  EWI_EVIDENCE_CATEGORIES,
  mapEvidenceCategory,
} from './evidence-categories';

describe('EWI evidence categories', () => {
  it('maps provider categories onto the stored classification', () => {
    expect(mapEvidenceCategory('profile')).toBe('identity_profile');
    expect(mapEvidenceCategory('legal')).toBe('legal_case');
    expect(mapEvidenceCategory('license')).toBe('license');
    expect(mapEvidenceCategory('publication')).toBe('publication');
    expect(mapEvidenceCategory(' Court Order ')).toBe('court_order');
  });

  it('keeps an unrecognized source type as a research finding', () => {
    expect(mapEvidenceCategory('web')).toBe('research_finding');
    expect(mapEvidenceCategory('')).toBe('research_finding');
  });

  it('lists each category once', () => {
    expect(new Set(EWI_EVIDENCE_CATEGORIES).size).toBe(
      EWI_EVIDENCE_CATEGORIES.length,
    );
  });
});
