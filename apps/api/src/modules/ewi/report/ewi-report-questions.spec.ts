import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  acceptRewrite,
  parseRewrites,
  polishQuestions,
} from './ewi-question-polisher';
import {
  buildGroundedCrossExamQuestions,
  buildQuestionDrafts,
  finalizeQuestions,
  isValidDraft,
  type QuestionDraft,
} from './ewi-report-questions';

function webItem(overrides: {
  level: 'strong' | 'possible' | 'other_person';
  kind: string;
  url: string;
  title: string;
  quote: string;
  claims?: Array<{ type: string; text: string; quote: string }>;
  publishedAt?: string | null;
}): ExpertEvidenceItem {
  return {
    sourceId: 'news',
    category: 'news',
    title: overrides.title,
    summary: 'Page summary.',
    url: overrides.url,
    informationStatus: overrides.level === 'strong' ? 'verified' : 'unverified',
    identityMatch: overrides.level === 'strong' ? 'matched' : 'uncertain',
    raw: {
      web: {
        kind: overrides.kind,
        publishedAt: overrides.publishedAt ?? null,
        match: {
          level: overrides.level,
          quote: overrides.quote,
          quoteVerified: true,
          basis: ['name and profession on the page'],
        },
        claims: overrides.claims ?? [],
      },
    },
  };
}

describe('evidence-based cross-examination questions', () => {
  it('does not invent questions when no finding was collected', () => {
    expect(
      buildGroundedCrossExamQuestions({
        expertName: 'Jane Doe',
        evidence: [],
        discrepancies: [],
      }),
    ).toEqual([]);
  });

  it('is not padded: one finding gives one question, not a hundred', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [
        {
          sourceId: 'state_license',
          category: 'license',
          title: 'CA License',
          summary:
            'California psychologist license PSY12345 is active and was issued in 2009.',
          url: 'https://example.test/license',
          informationStatus: 'verified',
          identityMatch: 'matched',
          source: {
            providerId: 'state_license',
            name: 'California DCA',
            retrievedAt: '2026-10-01T00:00:00.000Z',
            access: 'public',
          },
        },
      ],
    });
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      number: 1,
      label: 'verified',
      category: 'Background and credentials',
    });
    expect(questions[0].question).toContain('PSY12345');
    expect(questions[0].sources?.[0]).toMatchObject({
      name: 'California DCA',
      url: 'https://example.test/license',
      date: '2026-10-01',
    });
  });

  it('turns the Court TV article into a dated, quoted, sourced question', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jason A. Demery',
      evidence: [
        webItem({
          level: 'strong',
          kind: 'news',
          url: 'https://www.courttv.com/news/woman-charged-competent-for-trial/',
          title: 'Woman charged now competent for trial',
          quote:
            'state expert, Dr. Jason Demery, testified that she understands the charges',
          claims: [
            {
              type: 'other',
              text: 'Testified in a competency hearing',
              quote:
                'state expert, Dr. Jason Demery, testified that she understands the charges',
            },
          ],
          publishedAt: '2026-09-02T12:00:00Z',
        }),
      ],
    });
    expect(questions).toHaveLength(1);
    const [question] = questions;
    expect(question.question).toContain('courttv.com');
    expect(question.question).toContain('2026-09-02');
    expect(question.question).toContain('state expert, Dr. Jason Demery');
    expect(question.label).toBe('verified');
    expect(question.category).toBe('Public statements and media');
    expect(question.evidenceBasis).toContain('https://www.courttv.com/');
  });

  it('keeps allegations and unconfirmed identities conditional and labelled', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jason A. Demery',
      evidence: [
        webItem({
          level: 'strong',
          kind: 'news',
          url: 'https://news.example.test/a',
          title: 'Complaint filed',
          quote: 'a complaint alleges the evaluation ignored records',
          claims: [
            {
              type: 'allegation',
              text: 'complaint',
              quote: 'a complaint alleges the evaluation ignored records',
            },
          ],
        }),
        webItem({
          level: 'possible',
          kind: 'blog',
          url: 'https://blog.example.test/b',
          title: 'Blog about an expert',
          quote: 'the neuropsychologist billed for travel time',
          claims: [
            {
              type: 'other',
              text: 'billing',
              quote: 'the neuropsychologist billed for travel time',
            },
          ],
        }),
        webItem({
          level: 'other_person',
          kind: 'news',
          url: 'https://news.example.test/c',
          title: 'Different person',
          quote: 'a different Jason Demery was arrested',
          claims: [
            {
              type: 'allegation',
              text: 'arrest',
              quote: 'a different Jason Demery was arrested',
            },
          ],
        }),
      ],
    });
    expect(questions.map((q) => q.label).sort()).toEqual([
      'allegation',
      'unresolved',
    ]);
    expect(questions.find((q) => q.label === 'allegation')?.question).toMatch(
      /allegation/i,
    );
    expect(questions.find((q) => q.label === 'unresolved')?.question).toMatch(
      /^If the /,
    );
    expect(JSON.stringify(questions)).not.toContain('arrested');
  });

  it('drops generic, unsourced and duplicate drafts', () => {
    const base: QuestionDraft = {
      theme: 'Background and credentials',
      question:
        'The Gainesville clinic page lists you as a neuropsychologist, correct?',
      label: 'verified',
      sources: [{ name: 'example.test', url: 'https://example.test' }],
      evidenceBasis: 'Verified. example.test: “neuropsychologist”',
      anchors: ['neuropsychologist'],
    };
    expect(isValidDraft(base)).toBe(true);
    expect(isValidDraft({ ...base, sources: [] })).toBe(false);
    expect(
      isValidDraft({
        ...base,
        question:
          'You will concede this file does not upgrade the record, correct?',
      }),
    ).toBe(false);
    expect(
      isValidDraft({
        ...base,
        question:
          'The Gainesville clinic page lists you as a neuropsychologist.',
      }),
    ).toBe(false);
    expect(finalizeQuestions([base, { ...base }])).toHaveLength(1);
  });

  it('builds a question from a CV conflict and skips unverifiable rows', () => {
    const drafts = buildQuestionDrafts({
      expertName: 'Jane Doe',
      evidence: [],
      discrepancies: [
        {
          id: 'i1',
          severity: 'medium',
          title: 'CV specialty differs',
          description:
            'The CV states the specialty is Neurosurgery, but the NPI Registry lists Psychologist as the primary taxonomy.',
          evidenceIds: [],
          relatedUrls: ['https://npiregistry.cms.hhs.gov/provider-view/1'],
          label: 'conflicting',
          field: 'specialty',
          previousValue: null,
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: 'CV page 1',
          supportingSource: 'NPI Registry',
          priority: 1,
          sources: [],
        },
        {
          id: 'i2',
          severity: 'low',
          title: 'Not compared',
          description:
            'Open Payments was not searched, so nothing was compared here at all.',
          evidenceIds: [],
          relatedUrls: [],
          label: 'unable_to_verify',
          field: 'cv',
          previousValue: null,
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: null,
          supportingSource: null,
          priority: 5,
          sources: [],
        },
      ],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      label: 'unresolved',
      theme: 'Inconsistencies to resolve',
    });
    expect(drafts[0].sources[0].name).toBe('NPI Registry');
  });
});

describe('question polisher', () => {
  const draft: QuestionDraft = {
    theme: 'Public statements and media',
    question:
      'courttv.com wrote (2026-09-02): “state expert, Dr. Jason Demery, testified” That description of you is accurate, correct?',
    label: 'verified',
    sources: [
      {
        name: 'courttv.com',
        url: 'https://www.courttv.com/x',
        date: '2026-09-02',
      },
    ],
    evidenceBasis:
      'Verified. courttv.com (2026-09-02): “state expert, Dr. Jason Demery, testified”',
    anchors: ['state expert, Dr. Jason Demery, testified', '2026'],
  };

  it('accepts a rewrite that keeps the quote and adds no new number', () => {
    expect(
      acceptRewrite(
        'Court TV reported on 2026-09-02 that “state expert, Dr. Jason Demery, testified”, correct?',
        draft,
      ),
    ).toBe(true);
  });

  it('rejects a rewrite that drops the quote or invents a figure', () => {
    expect(acceptRewrite('You testified for the state, correct?', draft)).toBe(
      false,
    );
    expect(
      acceptRewrite(
        'Court TV reported on 2026-09-02 that “state expert, Dr. Jason Demery, testified” for 9 hours, correct?',
        draft,
      ),
    ).toBe(false);
  });

  it('keeps the draft wording when the model fails or returns junk', async () => {
    const failing = await polishQuestions([draft], () =>
      Promise.reject(new Error('rate limited')),
    );
    expect(failing[0].question).toBe(draft.question);
    const junk = await polishQuestions([draft], () =>
      Promise.resolve('not json'),
    );
    expect(junk[0].question).toBe(draft.question);
    expect(parseRewrites('not json').size).toBe(0);
  });

  it('applies a valid rewrite', async () => {
    const polished = await polishQuestions([draft], () =>
      Promise.resolve(
        JSON.stringify({
          items: [
            {
              id: '0',
              question:
                'Court TV reported on 2026-09-02 that “state expert, Dr. Jason Demery, testified”, correct?',
            },
          ],
        }),
      ),
    );
    expect(polished[0].question).toMatch(/^Court TV reported/);
  });
});
