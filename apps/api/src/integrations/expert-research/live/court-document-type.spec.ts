import {
  classifyCourtDocument,
  courtLevelOf,
  DOCKET_COVERAGE_NOTE,
  legalDocumentTypeFor,
} from './court-document-type';

describe('classifyCourtDocument', () => {
  it('treats CourtListener opinion hits as opinions, not dockets', () => {
    expect(
      classifyCourtDocument({
        searchKind: 'opinion',
        title: 'Smith v. Jones',
        description: 'Motion to exclude',
      }),
    ).toBe('opinion');
    expect(legalDocumentTypeFor('opinion', false)).toBe('case');
    expect(legalDocumentTypeFor('opinion', true)).toBe('expert_witness_case');
    expect(DOCKET_COVERAGE_NOTE).toMatch(
      /not evidence that a complete case docket/i,
    );
  });

  it('classifies RECAP filings by description', () => {
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Defendant Motion to Exclude Expert',
      }),
    ).toBe('motion');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description:
          'WITHDRAWN MOTION Daubert Motion to Exclude Testimony of Jane Smith, PhD',
        snippet: 'The Court will enter an order after the hearing.',
      }),
    ).toBe('motion');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Order Granting Motion in Limine',
      }),
    ).toBe('order');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Amended Complaint',
      }),
    ).toBe('pleading');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Deposition of Jane Smith',
      }),
    ).toBe('deposition');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Trial transcript of testimony',
      }),
    ).toBe('testimony');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        description: 'Exhibit A',
      }),
    ).toBe('other');
    expect(
      classifyCourtDocument({
        searchKind: 'recap_document',
        title: 'Smith v. Jones',
        description: '',
        documentNumber: '12',
        snippet: 'Defendant Motion to Strike Expert',
      }),
    ).toBe('motion');
  });

  it('maps filing classes onto legal document types', () => {
    expect(legalDocumentTypeFor('motion', false)).toBe('motion');
    expect(legalDocumentTypeFor('order', false)).toBe('order');
    expect(legalDocumentTypeFor('pleading', false)).toBe('pleading');
    expect(legalDocumentTypeFor('deposition', false)).toBe('deposition');
    expect(legalDocumentTypeFor('testimony', false)).toBe('testimony');
  });

  it('labels appellate versus trial courts without guessing', () => {
    expect(
      courtLevelOf('United States Court of Appeals for the 11th Circuit'),
    ).toBe('appellate');
    expect(courtLevelOf('District Court, M.D. Florida')).toBe('trial');
    expect(courtLevelOf('Unknown')).toBe('unknown');
  });
});
