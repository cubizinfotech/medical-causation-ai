import {
  basisFor,
  extractFacts,
  factsFromSnippet,
  officialSourceFor,
  officialSourceForAcronym,
  organizationsIn,
  sentencesOf,
} from './claim-topics';
import { subjectFromQuery } from './identity-assess';

const subject = (() => {
  const value = subjectFromQuery({
    expertName: 'Jason A. Demery',
    city: 'Gainesville, FL',
    specialty: 'Neuropsychology',
  });
  if (!value) throw new Error('subject');
  return value;
})();

describe('sentencesOf', () => {
  it('does not split after a title or an initial', () => {
    const pieces = sentencesOf(
      'Dr. Jason A. Demery, Ph.D., ABPP is a clinical neuropsychologist. He practices in Gainesville.',
    );
    expect(pieces[0]).toBe(
      'Dr. Jason A. Demery, Ph.D., ABPP is a clinical neuropsychologist.',
    );
    expect(pieces[1]).toBe('He practices in Gainesville.');
  });
});

describe('officialSourceFor', () => {
  it('recognizes the issuing body, a directory and a court, and nothing else', () => {
    expect(officialSourceFor('https://www.abpp.org/x')?.id).toBe('abpp');
    expect(
      officialSourceFor('https://www.theaacn.org/member-directory/1')?.id,
    ).toBe('aacn');
    expect(officialSourceFor('https://ecf.flmd.uscourts.gov/doc1/1')?.id).toBe(
      'courts',
    );
    expect(
      officialSourceFor('https://neuropsychologicalsciences.com/about'),
    ).toBeNull();
    expect(officialSourceForAcronym('abpp')?.hosts).toContain('abpp.org');
  });
});

describe('organizationsIn', () => {
  it('expands an acronym only when the text states the full name', () => {
    const stated = organizationsIn(
      'Board Certified by the American Board of Professional Psychology (ABPP-CN).',
    );
    expect(stated.some((org) => org.acronym === 'ABPP')).toBe(true);
    expect(stated[0].label).toMatch(
      /American Board of Professional Psychology/,
    );
    const bare = organizationsIn('Jason A. Demery, PhD, ABPP');
    expect(bare[0].label).toBe('ABPP');
  });
});

describe('basisFor', () => {
  it('is primary only for the body that issues the thing claimed', () => {
    expect(
      basisFor('membership', {
        url: 'https://www.theaacn.org/member-directory/1',
        ownPage: false,
      }),
    ).toBe('primary_source');
    expect(
      basisFor('board_certification', {
        url: 'https://www.theaacn.org/member-directory/1',
        ownPage: false,
      }),
    ).toBe('third_party');
    expect(
      basisFor('education', {
        url: 'https://clinic.example/about',
        ownPage: true,
      }),
    ).toBe('subject_stated');
    expect(
      basisFor('discipline', { url: 'https://news.example/a', ownPage: false }),
    ).toBe('allegation');
  });
});

describe('extractFacts', () => {
  it('finds degree, board certification, address and IME statements on the expert’s page, with verbatim quotes', () => {
    const text =
      'Dr. Jason A. Demery, Ph.D., ABPP is a clinical neuropsychologist. Board Certified in Clinical Neuropsychology by the American Board of Professional Psychology (ABPP-CN). Dr. Demery earned his Ph.D. from the University of Florida. He performs independent medical examinations. Office: 8491 NW 39th Ave, Gainesville, FL 32606.';
    const facts = extractFacts({
      url: 'https://clinic.example/about',
      kind: 'expert_website',
      title: 'About Dr. Demery',
      text,
      subject,
      ownPage: true,
    });
    const topics = new Set(facts.map((fact) => fact.topic));
    for (const topic of [
      'board_certification',
      'education',
      'ime',
      'office',
    ] as const) {
      expect(topics.has(topic)).toBe(true);
    }
    for (const fact of facts) {
      expect(text).toContain(fact.quote);
      expect(fact.from).toBe('page');
    }
    expect(facts.find((f) => f.topic === 'education')?.basis).toBe(
      'subject_stated',
    );
  });

  it('on a court page, counts only sentences that name the expert', () => {
    const facts = extractFacts({
      url: 'https://ecf.flmd.uscourts.gov/doc1/1',
      kind: 'court',
      title: 'Order',
      text: 'The defendant is board certified in forensic psychiatry. The Court appointed Jason Demery, Ph.D., ABPP, a board-certified clinical neuropsychologist, to evaluate the defendant.',
      subject,
      ownPage: false,
    });
    const certification = facts.filter(
      (f) => f.topic === 'board_certification',
    );
    expect(certification).toHaveLength(1);
    expect(certification[0].quote).toContain('Demery');
  });

  it('labels snippet-only statements as snippets', () => {
    const facts = factsFromSnippet({
      url: 'https://example.com/x',
      kind: 'other',
      snippet:
        'Jason Demery is a board-certified neuropsychologist in Gainesville.',
      subject,
    });
    expect(facts[0]?.from).toBe('snippet');
  });
});
