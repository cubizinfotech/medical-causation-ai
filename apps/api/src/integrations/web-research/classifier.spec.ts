/* eslint-disable @typescript-eslint/require-await -- test doubles */
import { parsePersonName } from '../expert-research/live/person-name';
import { classifyPages, mergeMatch, type ClassifierPage } from './classifier';
import type { IdentityAssessment, IdentitySubject } from './identity-assess';

const subject: IdentitySubject = {
  name: parsePersonName('Jason A. Demery') as NonNullable<
    ReturnType<typeof parsePersonName>
  >,
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
};

const PAGE_TEXT =
  'Dr. Jason A. Demery, a neuropsychologist in Gainesville, testified for the defense. He said the defendant understood the charges.';

const page: ClassifierPage = {
  id: 'p1',
  url: 'https://news.example/story',
  title: 'Trial coverage',
  text: PAGE_TEXT,
  fullPage: true,
};

const answer = (pages: unknown[]) => JSON.stringify({ pages });

describe('classifyPages', () => {
  it('keeps a verbatim quote and drops one the page does not contain', async () => {
    const llm = async () =>
      answer([
        {
          id: 'p1',
          about_subject: 'yes',
          reason: 'Names the neuropsychologist in Gainesville.',
          kind: 'news',
          summary: 'Testified for the defense.',
          published: '2026-09-02',
          link_quote:
            'Dr. Jason A. Demery, a neuropsychologist in Gainesville, testified for the defense.',
          claims: [
            {
              type: 'forensic',
              text: 'Testified for the defense',
              quote: 'testified for the defense',
            },
            {
              type: 'allegation',
              text: 'Was accused of fraud',
              quote: 'was accused of insurance fraud last year',
            },
          ],
        },
      ]);
    const result = await classifyPages(llm, subject, [page]);
    const item = result.get('p1');
    expect(item?.aboutSubject).toBe('yes');
    expect(item?.linkQuoteVerified).toBe(true);
    expect(item?.published).toBe('2026-09-02');
    expect(item?.claims.map((claim) => claim.type)).toEqual(['forensic']);
    // A claim the model returned without a topic still gets one, and a full
    // page marks it as read from the page.
    expect(item?.claims[0].topic).toBe('testimony');
    expect(item?.claims[0].from).toBe('page');
  });

  it('marks an invented link quote as unverified', async () => {
    const llm = async () =>
      answer([
        {
          id: 'p1',
          about_subject: 'yes',
          kind: 'news',
          summary: 'x',
          link_quote: 'Jason Demery is a famous pediatric surgeon in Boston',
        },
      ]);
    const item = (await classifyPages(llm, subject, [page])).get('p1');
    expect(item?.linkQuoteVerified).toBe(false);
  });

  it('survives invalid JSON, model errors and unknown page ids', async () => {
    expect(
      (await classifyPages(async () => 'not json', subject, [page])).size,
    ).toBe(0);
    expect(
      (
        await classifyPages(
          async () => {
            throw new Error('rate limited');
          },
          subject,
          [page],
        )
      ).size,
    ).toBe(0);
    expect(
      (
        await classifyPages(
          async () => answer([{ id: 'other', about_subject: 'yes' }]),
          subject,
          [page],
        )
      ).size,
    ).toBe(0);
  });

  it('accepts JSON wrapped in a code fence', async () => {
    const fenced =
      '```json\n' +
      answer([{ id: 'p1', about_subject: 'no', reason: 'A contractor.' }]) +
      '\n```';
    const item = (await classifyPages(async () => fenced, subject, [page])).get(
      'p1',
    );
    expect(item?.aboutSubject).toBe('no');
  });
});

describe('mergeMatch', () => {
  const assessment = (
    over: Partial<IdentityAssessment> = {},
  ): IdentityAssessment =>
    ({
      level: 'weak',
      confidence: 'low',
      nameMatch: 'full',
      basis: ['The full name appears.'],
      conflicts: [],
      quote: null,
      corroboration: {
        specialty: false,
        city: false,
        npi: false,
        context: false,
      },
      ...over,
    }) as IdentityAssessment;

  const model = (over = {}) => ({
    aboutSubject: 'yes' as const,
    reason: 'Same profession and city.',
    kind: 'news' as const,
    summary: '',
    published: null,
    linkQuote: 'Dr. Jason A. Demery, a neuropsychologist in Gainesville',
    linkQuoteVerified: true,
    claims: [],
    rating: null,
    ...over,
  });

  it('lets the model lower a match when it says the page is another person', () => {
    const merged = mergeMatch(
      assessment({ level: 'strong', confidence: 'high' }),
      model({ aboutSubject: 'no', reason: 'A roofing contractor in Ohio.' }),
      'Demery',
    );
    expect(merged.level).toBe('other_person');
    expect(merged.conflicts.join(' ')).toMatch(/different person/);
  });

  it('does not raise a match on a quote that is not verified on the page', () => {
    const merged = mergeMatch(
      assessment({ level: 'weak' }),
      model({ linkQuoteVerified: false }),
      'Demery',
    );
    expect(merged.level).toBe('weak');
  });

  it('raises a weak match only one step, and only on a verified quote', () => {
    const merged = mergeMatch(
      assessment({ level: 'weak' }),
      model(),
      'Demery',
      ['neuropsycholog'],
    );
    expect(merged.level).toBe('possible');
    expect(merged.quoteVerified).toBe(true);
  });

  it('relies on the rules alone when there is no model reading', () => {
    const merged = mergeMatch(
      assessment({ level: 'possible' }),
      undefined,
      'Demery',
    );
    expect(merged.level).toBe('possible');
    expect(merged.classifiedBy).toBe('rules');
  });
});
