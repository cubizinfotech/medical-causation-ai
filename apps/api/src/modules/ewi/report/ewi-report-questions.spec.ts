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
  QUESTION_TARGET,
  questionIsGrounded,
  type QuestionDraft,
} from './ewi-report-questions';
import { questionShortfallNote } from './ewi-report-input';

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
    expect(questions[0].evidenceIds).toEqual(['https://example.test/license']);
    expect(questions[0].basisKind).toBe('sourced_fact');
    expect(questions[0].excerpt).toContain('PSY12345');
    expect(questions[0].relevance).toMatch(/official regulator/i);
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
      evidenceIds: ['https://example.test'],
      basisKind: 'sourced_fact',
      relevance: 'A collected page states this fact.',
    };
    expect(isValidDraft(base)).toBe(true);
    expect(isValidDraft({ ...base, sources: [] })).toBe(false);
    expect(
      isValidDraft({
        ...base,
        question: 'Is every license in finding f1 current?',
      }),
    ).toBe(false);
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
          'Can you confirm if Legal cases (CourtListener) reports: “This public opinion contains Jason A. Demery”?',
        excerpt:
          'This public opinion contains Jason A. Demery and a Neuropsychology term.',
        evidenceBasis:
          'Unresolved. CourtListener: “This public opinion contains Jason A. Demery”',
      }),
    ).toBe(false);
    expect(
      isValidDraft({
        ...base,
        question:
          'Does the 2018-06-13 entry on neuropsychologicalsciences.com state: “Neuropsychological Sciences contact Jason A. Demery, Ph.D., ABPP-CN Tel. (352) 359”?',
        excerpt:
          'Neuropsychological Sciences contact Jason A. Demery, Ph.D., ABPP-CN Tel. (352) 359',
      }),
    ).toBe(false);
    expect(
      isValidDraft({
        ...base,
        question:
          'The Gainesville clinic page lists you as a neuropsychologist.',
      }),
    ).toBe(false);
    expect(isValidDraft({ ...base, evidenceIds: [] })).toBe(false);
    expect(finalizeQuestions([base, { ...base }])).toHaveLength(1);
    expect(
      questionIsGrounded({
        number: 1,
        category: 'Background and credentials',
        question:
          'NPI Registry (NPPES) lists license PY7500 as self-reported. Can you produce the official board record for PY7500?',
        evidenceBasis:
          'Unresolved. NPI Registry (NPPES): “PY7500” https://example.test/npi',
        label: 'unresolved',
        sources: [
          { name: 'NPI Registry (NPPES)', url: 'https://example.test/npi' },
        ],
        evidenceIds: ['https://example.test/npi'],
        excerpt: 'PY7500',
      }),
    ).toBe(true);
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
      basisKind: 'inconsistency',
    });
    expect(drafts[0].sources.map((source) => source.name)).toEqual(
      expect.arrayContaining(['NPI Registry', 'CV page 1']),
    );
    expect(drafts[0].evidenceIds).toEqual(
      expect.arrayContaining([
        'i1',
        'https://npiregistry.cms.hhs.gov/provider-view/1',
      ]),
    );
    expect(drafts[0].relevance).toMatch(/source conflict/i);
  });

  it('does not invent questions from an unconfirmed catalog miss', () => {
    expect(
      buildGroundedCrossExamQuestions({
        expertName: 'Jane Doe',
        evidence: [],
        discrepancies: [
          {
            id: 'cv-check-cvc-2',
            severity: 'low',
            title:
              'Not confirmed by available sources. Publication not confirmed in the catalogs searched: Axial movements',
            description:
              'CV: "Axial movements are relatively preserved." Absence from these catalogs is not proof the citation is false.',
            evidenceIds: [],
            relatedUrls: [],
            label: 'not_verified',
            field: 'publication',
            previousValue: 'Axial movements are relatively preserved.',
            currentValue: null,
            change: null,
            cvDate: null,
            cvSource: 'Uploaded CV: cv.pdf',
            supportingSource: 'OpenAlex',
            priority: 5,
            sources: [],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('does not invent questions from a catalog title miss', () => {
    expect(
      buildGroundedCrossExamQuestions({
        expertName: 'Jane Doe',
        evidence: [],
        discrepancies: [
          {
            id: 'cv-check-cvc-1',
            severity: 'medium',
            title:
              'Publication not found in the catalogs checked: Axial movements',
            description:
              'CV: "Axial movements are relatively preserved." OpenAlex: No work with this title.',
            evidenceIds: [],
            relatedUrls: [],
            label: 'not_found',
            field: 'publication',
            previousValue: 'Axial movements are relatively preserved.',
            currentValue: 'No work with this title.',
            change: null,
            cvDate: null,
            cvSource: 'Uploaded CV: cv.pdf',
            supportingSource: 'OpenAlex',
            priority: 3,
            sources: [],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('does not generate questions from coverage summaries, empty searches, or unimplemented sources', () => {
    expect(
      buildGroundedCrossExamQuestions({
        expertName: 'Jane Doe',
        evidence: [
          {
            sourceId: 'news',
            category: 'web',
            title: 'Web research coverage',
            summary: 'News and blogs were searched.',
            raw: { webSummary: true },
          },
          {
            sourceId: 'pubmed',
            category: 'publication',
            title: 'PubMed search',
            summary: 'PubMed returned no record.',
            url: 'https://pubmed.ncbi.nlm.nih.gov/',
          },
          {
            sourceId: 'justia',
            category: 'legal',
            title: 'Justia profile could not be read',
            summary: 'The page could not be read.',
            url: 'https://justia.example/blocked',
          },
          {
            sourceId: 'cv_profile',
            category: 'cv',
            title: 'Expert CV: cv.pdf',
            summary: '2 claim(s) read from the uploaded CV.',
            url: 'https://files.example/cv.pdf',
          },
        ],
        sourceStatuses: [
          {
            sourceId: 'patents',
            coverage: 'not_implemented',
            status: 'unavailable',
            itemCount: 0,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('keeps every source on a multi-record inconsistency', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [],
      discrepancies: [
        {
          id: 'multi',
          severity: 'high',
          title: 'License year conflict',
          description:
            'The uploaded CV, page 2, states the license was issued in 2005, and the California DCA record states 2009.',
          evidenceIds: ['cv-page-2', 'https://example.test/license'],
          relatedUrls: [
            'https://files.example/cv.pdf',
            'https://example.test/license',
          ],
          label: 'conflicting',
          field: 'license',
          previousValue: '2005',
          currentValue: '2009',
          change: null,
          cvDate: null,
          cvSource: 'Uploaded CV: cv.pdf',
          supportingSource: 'California DCA',
          priority: 1,
          sources: [
            {
              sourceId: 'cv',
              sourceName: 'Uploaded CV: cv.pdf',
              title: 'License issued 2005',
              url: 'https://files.example/cv.pdf',
              value: '2005',
            },
            {
              sourceId: 'state_license',
              sourceName: 'California DCA',
              title: 'License issued 2009',
              url: 'https://example.test/license',
              value: '2009',
            },
          ],
        },
      ],
    });
    expect(questions).toHaveLength(1);
    expect(questions[0].basisKind).toBe('inconsistency');
    expect(questions[0].sources?.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        'https://files.example/cv.pdf',
        'https://example.test/license',
      ]),
    );
    expect(questions[0].evidenceIds).toEqual(
      expect.arrayContaining([
        'multi',
        'cv-page-2',
        'https://example.test/license',
        'https://files.example/cv.pdf',
      ]),
    );
  });

  it('treats a blocked official license lookup as a limitation, not misconduct', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [
        {
          sourceId: 'npi_registry',
          category: 'license',
          title: 'NPPES license listing',
          summary: 'Self-reported Florida license ME12345.',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1',
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            verificationStatus: 'nppes_self_reported',
            licenseNumber: 'ME12345',
            nppesLicenses: [{ number: 'ME12345' }],
          },
          source: {
            providerId: 'npi_registry',
            name: 'NPI Registry (NPPES)',
            retrievedAt: '2026-10-01T00:00:00.000Z',
            access: 'public',
          },
        },
      ],
      sourceStatuses: [
        {
          sourceId: 'state_license',
          coverage: 'blocked_or_access_denied',
          outcome: 'restricted',
          itemCount: 0,
        },
      ],
    });
    const text = questions.map((question) => question.question).join(' ');
    expect(text).toContain('ME12345');
    expect(text).toMatch(/self-reported/i);
    expect(text).not.toMatch(/unlicensed|invalid license|false claim/i);
    expect(
      questions.some((question) => question.basisKind === 'limitation'),
    ).toBe(true);
    expect(
      questions.some((question) => question.basisKind === 'inconsistency'),
    ).toBe(false);
  });

  it('asks about an unverified CV credential by page without treating it as a conflict', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [],
      cvCheck: {
        document: {
          id: 'cv-1',
          name: 'cv.pdf',
          pageCount: 3,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        warnings: [],
        claims: [
          {
            id: 'c-license',
            category: 'license',
            statement: 'Florida license PY7500',
            details: { licenseNumber: 'PY7500', state: 'FL' },
            page: 2,
            quote: 'Florida psychologist license PY7500, issued 2009.',
          },
        ],
        comparisons: [],
      },
    });
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toMatch(/page 2/);
    expect(questions[0].question).toContain('PY7500');
    expect(questions[0].basisKind).toBe('evidence_gap');
    expect(questions[0].evidenceIds?.[0]).toContain('page-2');
    expect(questions[0].sources?.[0].name).toMatch(/Uploaded CV/);
  });

  it('explains a shortfall instead of padding when fewer than 100 facts exist', () => {
    expect(QUESTION_TARGET).toBe(100);
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jane Doe',
      evidence: [
        webItem({
          level: 'strong',
          kind: 'news',
          url: 'https://news.example/jane',
          title: 'Jane Doe testified',
          quote: 'Jane Doe, a neurologist in Boston, testified on Tuesday about concussion care.',
        }),
      ],
    });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThan(QUESTION_TARGET);
    expect(questionShortfallNote(questions.length)).toMatch(/facts were not invented/i);
    expect(questionShortfallNote(100)).toMatch(/target 100/i);
    expect(
      questionShortfallNote(questions.length, {
        evidence: [],
        sourceStatuses: [
          {
            sourceId: 'board_certification',
            coverage: 'not_implemented',
          },
        ],
      }),
    ).toMatch(/uploaded curriculum vitae/i);
    expect(
      questionShortfallNote(questions.length, {
        evidence: [],
        sourceStatuses: [
          {
            sourceId: 'board_certification',
            coverage: 'not_implemented',
          },
        ],
      }),
    ).toMatch(/board-certification directory/i);
  });

  it('adds a coverage-gap question when a source was blocked, without inventing a fact', () => {
    const drafts = buildQuestionDrafts({
      expertName: 'Jane Doe',
      evidence: [],
      sourceStatuses: [
        {
          sourceId: 'social',
          coverage: 'blocked_or_access_denied',
          message: 'Login required',
        },
      ],
    });
    expect(drafts.some((draft) => /login/i.test(draft.question))).toBe(true);
    expect(drafts.every((draft) => draft.basisKind === 'limitation')).toBe(
      true,
    );
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
    evidenceIds: ['https://www.courttv.com/x'],
    basisKind: 'sourced_fact',
    relevance: 'A collected page states this fact.',
    excerpt: 'state expert, Dr. Jason Demery, testified',
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

  it('rejects NPI-only and Unnamed case drafts and keeps evidence-grounded questions', () => {
    const useful: QuestionDraft = {
      theme: 'Prior testimony and legal matters',
      question:
        'A court document, “Order granting motion to compel CME”, states: “Jason Demery, Ph.D., ABPP, a board-certified clinical neuropsychologist” Did you give that examination?',
      label: 'unresolved',
      sources: [
        {
          name: 'CourtListener',
          url: 'https://www.courtlistener.com/docket/68056076/52/',
        },
      ],
      evidenceBasis:
        'Unresolved. CourtListener: “board-certified clinical neuropsychologist” https://www.courtlistener.com/docket/68056076/52/',
      anchors: ['board-certified clinical neuropsychologist'],
      evidenceIds: ['https://www.courtlistener.com/docket/68056076/52/'],
      basisKind: 'sourced_fact',
      relevance: 'A public filing names the expert.',
      excerpt: 'board-certified clinical neuropsychologist',
    };
    expect(isValidDraft(useful)).toBe(true);
    expect(
      isValidDraft({
        ...useful,
        question:
          'NPI Registry (NPPES) reported: "NPI 1700077724". You are aware of that, correct?',
        excerpt: 'NPI 1700077724',
        evidenceBasis: 'NPI 1700077724',
        anchors: ['1700077724'],
      }),
    ).toBe(false);
    expect(
      isValidDraft({
        ...useful,
        question:
          'Legal cases (CourtListener) reported “Unnamed case”: You are aware of that, correct?',
        excerpt: 'Unnamed case',
        evidenceBasis: 'Unnamed case',
        anchors: ['Unnamed case'],
      }),
    ).toBe(false);

    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jason A. Demery',
      evidence: [
        {
          sourceId: 'npi_registry',
          category: 'identity',
          title: 'NPI Registry: Jason Andrew Demery, PhD (NPI 1700077724)',
          summary: 'NPI 1700077724',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          informationStatus: 'verified',
          identityMatch: 'matched',
          raw: { npi: '1700077724' },
          source: {
            providerId: 'npi_registry',
            name: 'NPI Registry (NPPES)',
            retrievedAt: '2026-10-22T00:00:00.000Z',
            access: 'public',
          },
        },
        {
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Unnamed case',
          summary: 'Search result.',
          url: 'https://www.courtlistener.com/docket/6664619/49/1/united-states-v-butl',
          informationStatus: 'unverified',
          raw: { caseName: 'Unnamed case' },
          source: {
            providerId: 'courtlistener',
            name: 'Legal cases (CourtListener)',
            retrievedAt: '2026-10-22T00:00:00.000Z',
            access: 'public',
          },
        },
        {
          sourceId: 'pubmed',
          category: 'publication',
          title:
            'Operating characteristics of executive functioning tests following traumatic brain injury.',
          summary: 'PubMed lists Demery JA first.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21069617/',
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: { pmid: '21069617', authorship: 'first of 5 authors' },
          source: {
            providerId: 'pubmed',
            name: 'Publications (PubMed / NCBI)',
            retrievedAt: '2026-10-22T00:00:00.000Z',
            access: 'public',
          },
        },
      ],
    });
    const text = questions.map((question) => question.question).join('\n');
    expect(text).not.toMatch(/NPI 1700077724/);
    expect(text).not.toMatch(/Unnamed case/);
    expect(text).toMatch(/21069617/);
  });

  it('rejects contact-dump, boilerplate, and repetitive biography questions', () => {
    const questions = buildGroundedCrossExamQuestions({
      expertName: 'Jason A. Demery',
      evidence: [
        webItem({
          level: 'strong',
          kind: 'publication',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3830977/',
          title: 'GFAP study',
          quote:
            'Jason Demery, Email: jasondemery@gmail.com, 8491 NW 39th Ave., Gainesville',
          claims: [
            {
              type: 'credential',
              text: 'email',
              quote:
                'Jason Demery, Email: jasondemery@gmail.com, Assistant Professor, 8491 NW 39th Ave.',
            },
          ],
        }),
        webItem({
          level: 'strong',
          kind: 'profile',
          url: 'https://abpp.org/directory/entry/32415/',
          title: 'ABPP directory',
          quote: 'Board Certified In Clinical Neuropsychology',
          claims: [
            {
              type: 'credential',
              text: 'cert',
              quote: 'Board Certified In Clinical Neuropsychology',
            },
            {
              type: 'credential',
              text: 'boilerplate',
              quote:
                'This directory lists all current ABPP board certified psychologists.',
            },
            {
              type: 'credential',
              text: 'renewal',
              quote:
                'Board certification is an annual certification that is due January 1.',
            },
          ],
        }),
        webItem({
          level: 'strong',
          kind: 'expert_website',
          url: 'https://neuropsychologicalsciences.com/about/',
          title: 'About',
          quote: 'Board certified in clinical neuropsychology',
          claims: [
            {
              type: 'credential',
              text: 'a',
              quote:
                'Dr. Demery is board certified in clinical neuropsychology by the American Board of Professional Psychology (ABPP).',
            },
            {
              type: 'credential',
              text: 'b',
              quote:
                'He completed his Ph.D. at the University of Florida followed by a postdoctoral fellowship.',
            },
            {
              type: 'credential',
              text: 'c',
              quote:
                'Jason Demery, Ph.D. Board Certified in Clinical Neuropsychology',
            },
          ],
        }),
        {
          sourceId: 'courtlistener',
          category: 'motion',
          title: 'Caption not listed on this search result',
          summary:
            'This public motion contains Jason A. Demery, a Neuropsychology term, and admissibility-challenge language (Daubert, Frye, Rule 702, or a motion to exclude).',
          url: 'https://www.courtlistener.com/docket/66837428/431/head-kandy-llc-v-mcneill/',
          informationStatus: 'unverified',
          raw: {
            caseName: 'Caption not listed on this search result',
            documentType: 'motion',
            challenge: { standard: 'daubert' },
          },
          source: {
            providerId: 'courtlistener',
            name: 'Legal cases (CourtListener)',
            retrievedAt: '2026-10-22T00:00:00.000Z',
            access: 'public',
          },
        },
      ],
    });
    const text = questions.map((question) => question.question).join('\n');
    expect(text).not.toMatch(/jasondemery@gmail\.com/i);
    expect(text).not.toMatch(/You are aware of that, correct\?/i);
    expect(text).not.toMatch(/This directory lists all current/i);
    expect(text).not.toMatch(/This public motion contains/i);
    expect(text).not.toMatch(/This public opinion contains/i);
    expect(text).toMatch(/Head Kandy LLC v\. Mcneill/);
    const about = questions.filter((question) =>
      question.sources?.some((source) =>
        source.url?.includes('neuropsychologicalsciences.com'),
      ),
    );
    expect(about.length).toBeLessThanOrEqual(2);
    expect(questions.length).toBeLessThan(8);
  });

  it('rejects a polish that only adds “You are aware of that, correct?”', () => {
    expect(
      acceptRewrite(
        'Court TV reported: “state expert, Dr. Jason Demery, testified”. You are aware of that, correct?',
        {
          theme: 'Public statements and media',
          question:
            'Court TV reported: “state expert, Dr. Jason Demery, testified”. Is that an accurate description of your testimony?',
          label: 'verified',
          sources: [{ name: 'courttv.com' }],
          evidenceBasis:
            'Verified. courttv.com: “state expert, Dr. Jason Demery, testified”',
          anchors: ['state expert, Dr. Jason Demery, testified'],
          evidenceIds: ['https://www.courttv.com/x'],
          basisKind: 'sourced_fact',
          relevance: 'News quote.',
        },
      ),
    ).toBe(false);
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
