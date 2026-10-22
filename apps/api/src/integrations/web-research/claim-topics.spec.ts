import {
  basisFor,
  extractFacts,
  factsFromSnippet,
  isHeadingClaim,
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

  it('extracts forensic and medicolegal IME language', () => {
    const facts = extractFacts({
      url: 'https://clinic.example/about',
      kind: 'expert_website',
      title: 'About',
      text: 'Dr. Demery provides forensic neuropsychological evaluations and medicolegal evaluations for attorneys and courts.',
      subject,
      ownPage: true,
    });
    expect(facts.some((fact) => fact.topic === 'ime')).toBe(true);
  });

  it('rejects heading-only patent, discipline and award labels', () => {
    const facts = extractFacts({
      url: 'https://directory.example/x',
      kind: 'directory',
      title: 'Profile',
      text: 'Jason Demery. Clinical Trials, Grants & Patents. Disciplinary Actions & Sanctions. Award Winning Hospitals.',
      subject,
      ownPage: false,
    });
    expect(facts.some((fact) => fact.topic === 'patent')).toBe(false);
    expect(facts.some((fact) => fact.topic === 'discipline')).toBe(false);
    expect(facts.some((fact) => fact.topic === 'award')).toBe(false);
  });

  it('does not treat related-video titles as the expert’s criminal record', () => {
    const facts = extractFacts({
      url: 'https://www.youtube.com/watch?v=dQPVnCi9EyQ',
      kind: 'video',
      title:
        "The Frostproof Massacre: State Expert Dr. Jason Demery's Full Testimony",
      text: 'Dr. Jason Demery testified as a state expert. Inside the courtroom as Caleb Flynn is convicted of killing his wife Ashley Flynn.',
      subject,
      ownPage: false,
    });
    expect(facts.some((fact) => fact.topic === 'criminal')).toBe(false);
  });

  it('does not treat a research paper about homicide offenders as the author’s criminal record', () => {
    const facts = extractFacts({
      url: 'https://www.researchgate.net/publication/281170036_Domestic_Homicide_Neuropsychological_Profiles_of_Murderers_Who_Kill_Family_Members',
      kind: 'publication',
      title:
        'Domestic Homicide: Neuropsychological Profiles of Murderers Who Kill Family Members and Intimate Partners',
      text: 'Hanlon, Brook, Demery JA, Cunningham. Murderers who kill family members had more extensive criminal history than other offenders.',
      subject,
      ownPage: false,
    });
    expect(facts.some((fact) => fact.topic === 'criminal')).toBe(false);
  });

  it('does not treat examining a defendant as the expert’s criminal record', () => {
    const facts = extractFacts({
      url: 'https://ecf.example/1',
      kind: 'court',
      title: 'Order',
      text: 'The Court appointed Jason Demery to examine the criminal defendant regarding competency.',
      subject,
      ownPage: false,
    });
    expect(facts.some((fact) => fact.topic === 'criminal')).toBe(false);
  });

  it('keeps a university policy only when it is about the expert’s role', () => {
    const policy = extractFacts({
      url: 'https://uf.example/coi',
      kind: 'university',
      title: 'Outside activity',
      text: 'Jason Demery, faculty at the University of Florida, is subject to the conflict of interest consulting policy.',
      subject,
      ownPage: false,
    });
    expect(policy.some((fact) => fact.topic === 'university_rules')).toBe(true);
    const syllabus = extractFacts({
      url: 'https://uf.example/syllabus',
      kind: 'university',
      title: 'CLP4302',
      text: 'Cell phones and electronics must be silenced. Papers use Times New Roman. Late work loses a letter grade.',
      subject,
      ownPage: false,
    });
    expect(syllabus.some((fact) => fact.topic === 'university_rules')).toBe(
      false,
    );
  });

  it('labels NIH PI listings as personal awards and papers as associated research', () => {
    const award = extractFacts({
      url: 'https://reporter.nih.gov/project-details/1',
      kind: 'publication',
      title: 'NIH RePORTER',
      text: 'Jason Demery is the principal investigator of R01NS012345 funded by NIH.',
      subject,
      ownPage: false,
    });
    expect(award.find((f) => f.topic === 'grant')?.text).toMatch(
      /^Personal award:/,
    );
    const paper = extractFacts({
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1/',
      kind: 'publication',
      title: 'Article',
      text: 'This work by Jason Demery was funded by NIH grant support through TRACK-TBI.',
      subject,
      ownPage: false,
    });
    expect(paper.find((f) => f.topic === 'grant')?.text).toMatch(
      /^Associated with grant-funded research:/,
    );
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

describe('isHeadingClaim', () => {
  it('treats directory nav labels as headings', () => {
    expect(isHeadingClaim('Clinical Trials, Grants & Patents')).toBe(true);
    expect(isHeadingClaim('Disciplinary Actions & Sanctions')).toBe(true);
    expect(isHeadingClaim('Award Winning Hospitals')).toBe(true);
    expect(
      isHeadingClaim(
        'Dr. Demery is board certified in clinical neuropsychology.',
      ),
    ).toBe(false);
  });
});
