/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- test doubles */
import { parsePersonName } from '../expert-research/live/person-name';
import type { IdentitySubject } from './identity-assess';
import { clusterRecords, fingerprintOf } from './identity-clusterer';
import type { MatchLevel, WebRecord } from './web-research.types';

const subject: IdentitySubject = {
  name: parsePersonName('Jason A. Demery') as NonNullable<
    ReturnType<typeof parsePersonName>
  >,
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
};

function record(id: string, level: MatchLevel): WebRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    kind: 'news',
    snippet: null,
    summary: '',
    publishedAt: null,
    retrievedAt: '2026-10-20T00:00:00.000Z',
    searchProviders: ['test'],
    queries: [],
    read: 'read',
    readNote: null,
    match: {
      level,
      confidence: level === 'strong' ? 'high' : 'low',
      basis: ['name'],
      conflicts: [],
      quote: null,
      quoteVerified: false,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims: [],
  };
}

describe('fingerprintOf', () => {
  it('captures the written name form, credential and state', () => {
    const fingerprint = fingerprintOf(
      'Dr. Jason B. Demery, PhD of Dallas, TX opened a new office downtown.',
      subject,
    );
    expect(fingerprint.written).toMatch(/Jason B\.? Demery/);
    expect(fingerprint.credential).toBe('PhD');
    expect(fingerprint.state).toBe('TX');
  });

  it('returns an empty fingerprint when the name is not on the page', () => {
    expect(fingerprintOf('A page about fishing.', subject)).toEqual({
      written: null,
      credential: null,
      state: null,
    });
  });
});

describe('clusterRecords', () => {
  it('keeps the subject and a same-name person in separate candidates', () => {
    const subjectPage = record('r1', 'strong' as MatchLevel);
    const otherPage = record('r2', 'other_person' as MatchLevel);
    const fingerprints = new Map([
      ['r1', { written: 'Jason A. Demery', credential: 'PhD', state: 'FL' }],
      ['r2', { written: 'Jason B. Demery', credential: null, state: 'TX' }],
    ]);
    const { candidates, records } = clusterRecords(
      [subjectPage, otherPage],
      fingerprints,
      subject,
      'Jason A. Demery, Neuropsychology, Gainesville, FL',
    );
    const mine = candidates.find((candidate) => candidate.role === 'subject');
    const other = candidates.find((candidate) => candidate.role === 'other');
    expect(mine?.recordIds).toEqual(['r1']);
    expect(other?.recordIds).toEqual(['r2']);
    expect(other?.label).toMatch(/Another person/);
    expect(records.find((item) => item.id === 'r1')?.candidateId).toBe(
      'cand-subject',
    );
    expect(records.find((item) => item.id === 'r2')?.candidateId).toBe(
      other?.id,
    );
  });

  it('never attributes a bare same-name page to the subject', () => {
    const { candidates } = clusterRecords(
      [record('r3', 'weak' as MatchLevel)],
      new Map([
        ['r3', { written: 'Jason Demery', credential: null, state: null }],
      ]),
      subject,
      'Jason A. Demery',
    );
    expect(
      candidates.find((candidate) => candidate.role === 'subject'),
    ).toBeUndefined();
    const unconfirmed = candidates.find(
      (candidate) => candidate.id === 'cand-unconfirmed',
    );
    expect(unconfirmed?.recordIds).toEqual(['r3']);
    expect(unconfirmed?.basis[0]).toMatch(/not attributed to the subject/);
  });

  it('splits different people who share the name by state and middle initial', () => {
    const { candidates } = clusterRecords(
      [record('a', 'weak' as MatchLevel), record('b', 'weak' as MatchLevel)],
      new Map([
        ['a', { written: 'Jason C. Demery', credential: null, state: 'OH' }],
        ['b', { written: 'Jason A. Demery', credential: null, state: 'GA' }],
      ]),
      subject,
      'Jason A. Demery',
    );
    expect(
      candidates.filter((candidate) => candidate.role === 'other'),
    ).toHaveLength(2);
  });

  it('drops pages with no match at all', () => {
    const { candidates, records } = clusterRecords(
      [record('z', 'none' as MatchLevel)],
      new Map(),
      subject,
      'Jason A. Demery',
    );
    expect(candidates).toHaveLength(0);
    expect(records[0].candidateId).toBeNull();
  });
});
