import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  applyChallengeReadings,
  challengeCandidates,
  readExpertChallenge,
  validateChallengeReading,
} from './expert-challenge';
import { buildLegalResearchDossier } from './legal-research-analyzer';

const excerpt =
  'Defendant moves to exclude the causation opinion of Dr. Jane Smith under Daubert. For the reasons above, the motion to exclude Dr. Smith is GRANTED in part.';

function opinion(id: number, text = excerpt): ExpertEvidenceItem {
  return {
    sourceId: 'courtlistener',
    category: 'legal',
    title: `Doe v. Roe ${id} (2019)`,
    summary: 'Opinion with challenge language.',
    url: `https://www.courtlistener.com/opinion/${id}/doe-v-roe/`,
    identityMatch: 'matched',
    raw: {
      documentType: 'expert_witness_case',
      caseName: `Doe v. Roe ${id}`,
      court: 'District Court, D. Arizona',
      documentDate: `2019-0${id}-01`,
      challenge: {
        standard: 'daubert',
        outcome: 'not_determined',
        role: 'unclear',
        quote: null,
        basis: 'not_determined',
        excerpts: [text],
        excerptSource: 'opinion_text',
      },
    },
  };
}

describe('expert challenge readings', () => {
  it('accepts an exact quote that names the expert and states the ruling', () => {
    expect(
      validateChallengeReading(
        {
          id: 'c1',
          role: 'challenged_expert',
          outcome: 'limited',
          quote: 'the motion to exclude Dr. Smith is GRANTED in part',
        },
        [excerpt],
        'smith',
      ),
    ).toEqual({
      outcome: 'limited',
      role: 'challenged_expert',
      quote: 'the motion to exclude Dr. Smith is GRANTED in part',
    });
  });

  it('rejects quotes that are not in the text, omit the expert, or do not fit the outcome', () => {
    const base = { id: 'c1', role: 'challenged_expert' };
    // Paraphrase, not the court's words.
    expect(
      validateChallengeReading(
        { ...base, outcome: 'excluded', quote: 'Dr. Smith was excluded' },
        [excerpt],
        'smith',
      ).outcome,
    ).toBe('not_determined');
    // Real words, but they do not name the expert.
    expect(
      validateChallengeReading(
        { ...base, outcome: 'excluded', quote: 'For the reasons above' },
        [excerpt],
        'smith',
      ).outcome,
    ).toBe('not_determined');
    // A motion is not a ruling that admits the testimony.
    expect(
      validateChallengeReading(
        {
          ...base,
          outcome: 'admitted',
          quote:
            'Defendant moves to exclude the causation opinion of Dr. Jane Smith',
        },
        [excerpt],
        'smith',
      ).outcome,
    ).toBe('not_determined');
    // Unknown outcome values fall back.
    expect(
      validateChallengeReading(
        {
          ...base,
          outcome: 'won',
          quote: 'the motion to exclude Dr. Smith is GRANTED',
        },
        [excerpt],
        'smith',
      ).outcome,
    ).toBe('not_determined');
  });

  it('records a challenge to another witness as not about the expert', () => {
    const text =
      'the Court denies Dr. Jane Smith’s motion to exclude the expert testimony of Dr. Ravi Tikoo';
    expect(
      validateChallengeReading(
        {
          id: 'c1',
          role: 'other',
          outcome: 'not_challenged',
          quote:
            "the Court denies Dr. Jane Smith's motion to exclude the expert testimony of Dr. Ravi Tikoo",
        },
        [text],
        'smith',
      ),
    ).toMatchObject({ outcome: 'not_challenged', role: 'other' });
  });

  it('writes validated readings into evidence and the dossier ranks them', () => {
    const evidence = [
      opinion(1),
      opinion(2, 'Dr. Smith testified about migraines.'),
    ];
    const candidates = challengeCandidates(evidence, 8);
    expect(candidates.map((candidate) => candidate.id)).toEqual(['c1', 'c2']);
    const { evidence: updated, determined } = applyChallengeReadings(
      evidence,
      candidates,
      [
        {
          id: 'c1',
          role: 'challenged_expert',
          outcome: 'limited',
          quote: 'the motion to exclude Dr. Smith is GRANTED in part',
        },
        // Invented ruling for an excerpt that states none.
        {
          id: 'c2',
          role: 'challenged_expert',
          outcome: 'excluded',
          quote: 'Dr. Smith is excluded',
        },
      ],
      'smith',
    );
    expect(determined).toBe(1);
    expect(updated[0].raw?.findingsRegardingExpert).toMatch(
      /^Limited — the court’s words: “the motion to exclude Dr\. Smith is GRANTED in part”/,
    );
    expect(readExpertChallenge(updated[1].raw?.challenge)?.outcome).toBe(
      'not_determined',
    );
    // Already-read opinions are not sent again.
    expect(challengeCandidates(updated, 8).map((c) => c.index)).toEqual([1]);

    const dossier = buildLegalResearchDossier({ evidence: updated });
    expect(
      dossier.challenges.map((record) => record.challenge.outcome),
    ).toEqual(['limited', 'not_determined']);
    expect(dossier.challenges[0].challenge.note).toMatch(/court’s words/);
    expect(dossier.challenges[1].challenge.note).toMatch(/Read the opinion/);
  });

  it('never trusts an outcome stored without a quote', () => {
    expect(
      readExpertChallenge({ outcome: 'excluded', quote: null, excerpts: [] }),
    ).toMatchObject({ outcome: 'not_determined', basis: 'not_determined' });
  });
});
