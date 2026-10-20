import { verifyClaims } from './verify-claims';
import type { WebClaim, WebRecord } from './web-research.types';

function record(
  id: string,
  url: string,
  claims: WebClaim[],
  over: Partial<WebRecord> = {},
): WebRecord {
  return {
    id,
    url,
    title: id,
    kind: 'other',
    snippet: null,
    summary: 'summary',
    publishedAt: null,
    retrievedAt: '2026-10-20T00:00:00.000Z',
    searchProviders: [],
    queries: [],
    read: 'read',
    readNote: null,
    match: {
      level: 'strong',
      confidence: 'high',
      basis: [],
      conflicts: [],
      quote: 'Demery quote',
      quoteVerified: true,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims,
    ...over,
  };
}

const claim = (over: Partial<WebClaim> = {}): WebClaim => ({
  type: 'credential',
  text: 'Board certified (ABPP-CN)',
  quote: 'Board Certified in Clinical Neuropsychology (ABPP-CN)',
  topic: 'board_certification',
  basis: 'subject_stated',
  from: 'page',
  ...over,
});

describe('verifyClaims', () => {
  it('reports a claim as not confirmed when the issuing body’s site was searched and nothing matched', () => {
    const result = verifyClaims(
      [record('a', 'https://clinic.example/about', [claim()])],
      [{ label: 'abpp.org', topics: ['board_certification'] }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('not_confirmed');
    expect(result[0].claim).toContain('ABPP-CN');
    expect(result[0].note).toMatch(/abpp\.org/);
    expect(result[0].claimedAt).toEqual(['https://clinic.example/about']);
  });

  it('says not checked when the issuing body was never searched', () => {
    const result = verifyClaims(
      [record('a', 'https://clinic.example/about', [claim()])],
      [],
    );
    expect(result[0].status).toBe('not_checked');
    expect(result[0].note).toMatch(/not searched/);
  });

  it('confirms only from a page of the issuing body that was read', () => {
    const official = record('o', 'https://www.abpp.org/find/jason-demery', [
      claim({ basis: 'primary_source' }),
    ]);
    const confirmed = verifyClaims([official], []);
    expect(confirmed[0].status).toBe('confirmed');
    expect(confirmed[0].confirmedBy?.url).toBe(
      'https://www.abpp.org/find/jason-demery',
    );

    const snippetOnly = verifyClaims(
      [
        record(
          'o',
          'https://www.abpp.org/find/jason-demery',
          [claim({ basis: 'primary_source', from: 'snippet' })],
          { read: 'snippet_only' },
        ),
      ],
      [],
    );
    expect(snippetOnly[0].status).not.toBe('confirmed');
  });

  it('ignores pages that are not tied to the expert', () => {
    const other = record('x', 'https://other.example/a', [claim()], {
      match: {
        level: 'other_person',
        confidence: 'low',
        basis: [],
        conflicts: [],
        quote: null,
        quoteVerified: false,
        classifiedBy: 'rules',
      },
    });
    expect(verifyClaims([other], [])).toEqual([]);
  });
});
