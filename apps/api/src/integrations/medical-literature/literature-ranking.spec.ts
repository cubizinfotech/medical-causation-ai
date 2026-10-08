import {
  classifyArticle,
  classifyEvidence,
  extractAbstractExcerpt,
  isReversedDirection,
  isUsableSummary,
  parsePublicationYear,
  rankCandidates,
} from './literature-ranking';
import type { PubMedSummary } from './medical-literature.types';

function summary(
  uid: string,
  title: string,
  pubtype: string[] = ['Journal Article'],
): PubMedSummary {
  return { uid, title, pubtype, attributes: ['Has Abstract'], lang: ['eng'] };
}

describe('literature ranking', () => {
  it('classifies by the strongest study design', () => {
    expect(
      classifyEvidence(['Review', 'Meta-Analysis', 'Journal Article']),
    ).toBe('meta_analysis');
    expect(classifyEvidence(['Practice Guideline'])).toBe('guideline');
    expect(classifyEvidence(['Observational Study'])).toBe('observational');
    expect(classifyEvidence(['Journal Article'])).toBe('other');
  });

  it('drops retracted papers, letters, non-English and abstract-less records', () => {
    expect(isUsableSummary(summary('1', 'Ok'))).toBe(true);
    expect(
      isUsableSummary(summary('2', 'Bad', ['Retracted Publication'])),
    ).toBe(false);
    expect(isUsableSummary(summary('3', 'Letter', ['Letter']))).toBe(false);
    expect(isUsableSummary({ ...summary('4', 'Deutsch'), lang: ['ger'] })).toBe(
      false,
    );
    expect(
      isUsableSummary({ ...summary('5', 'No abstract'), attributes: [] }),
    ).toBe(false);
  });

  it('ranks titles naming both injury and condition above off-topic hits', () => {
    const summaries = new Map([
      ['10', summary('10', 'Transfusion thresholds for guiding transfusion')],
      [
        '20',
        summary('20', 'Risk of stroke after traumatic brain injury', [
          'Meta-Analysis',
        ]),
      ],
      [
        '30',
        summary('30', 'Retracted stroke paper', ['Retracted Publication']),
      ],
    ]);

    const ranked = rankCandidates({
      rankedLists: [
        { query: 'stroke risk after tbi', ids: ['10', '30', '20'] },
      ],
      summaries,
      exposureTerms: ['traumatic brain injury'],
      outcomeTerms: ['stroke'],
    });

    expect(ranked.map((r) => r.pmid)).toEqual(['20', '10']);
    expect(ranked[0].matchedQueries).toEqual(['stroke risk after tbi']);
  });

  it('reads the study design from the title when PubMed only says "Journal Article"', () => {
    expect(
      classifyArticle(
        ['Journal Article'],
        'Increased Risk of Stroke in Patients of Concussion: A Nationwide Cohort Study.',
      ),
    ).toBe('observational');
    expect(classifyArticle(['Meta-Analysis'], 'Anything')).toBe(
      'meta_analysis',
    );
  });

  it('detects studies of the reverse direction', () => {
    expect(
      isReversedDirection(
        'risk of motor vehicle collision after stroke',
        ['motor vehicle collision'],
        ['stroke'],
      ),
    ).toBe(true);
    expect(
      isReversedDirection(
        'risk of stroke after motor vehicle collision',
        ['motor vehicle collision'],
        ['stroke'],
      ),
    ).toBe(false);
  });

  it('ranks causation studies above treatment and reverse-direction studies', () => {
    const summaries = new Map([
      [
        '1',
        summary(
          '1',
          'Efficacy of corticosteroids for stroke and traumatic brain injury',
          ['Meta-Analysis'],
        ),
      ],
      [
        '2',
        summary('2', 'Risk of motor vehicle collision after stroke', [
          'Systematic Review',
        ]),
      ],
      [
        '3',
        summary('3', 'Long-term risk of stroke after traumatic brain injury'),
      ],
    ]);

    const ranked = rankCandidates({
      rankedLists: [{ query: 'q', ids: ['1', '2', '3'] }],
      summaries,
      exposureTerms: ['traumatic brain injury', 'motor vehicle collision'],
      outcomeTerms: ['stroke'],
    });

    expect(ranked.map((r) => r.pmid)).toEqual(['3', '1', '2']);
  });

  it('drops studies that never name the claimed condition once enough do', () => {
    const titles = [
      'Stroke risk after concussion',
      'Long-term stroke after head injury',
      'Ischemic stroke following brain trauma',
      'Tranexamic acid in traumatic brain injury',
    ];
    const summaries = new Map(
      titles.map((title, i) => [String(i), summary(String(i), title)]),
    );
    const params = {
      summaries,
      exposureTerms: ['traumatic brain injury'],
      outcomeTerms: ['stroke'],
    };

    const focused = rankCandidates({
      ...params,
      rankedLists: [{ query: 'q', ids: ['0', '1', '2', '3'] }],
    });
    expect(focused.map((r) => r.pmid)).not.toContain('3');

    // With fewer than three on-topic studies, nothing is dropped.
    const sparse = rankCandidates({
      ...params,
      rankedLists: [{ query: 'q', ids: ['0', '3'] }],
    });
    expect(sparse.map((r) => r.pmid).sort()).toEqual(['0', '3']);
  });

  it('prefers the conclusion section of an abstract', () => {
    const html =
      '<h4>Background</h4>Some background. <h4>Conclusions</h4>TBI was associated with a higher risk of stroke. More text here.';
    expect(extractAbstractExcerpt(html)).toBe(
      'TBI was associated with a higher risk of stroke. More text here.',
    );
    expect(
      extractAbstractExcerpt(
        'Methods: a. CONCLUSIONS: Risk rose &amp; persisted.',
      ),
    ).toBe('Risk rose & persisted.');
  });

  it('reads the year from PubMed dates', () => {
    expect(parsePublicationYear('2022 Mar 15')).toBe(2022);
    expect(parsePublicationYear(undefined)).toBeUndefined();
  });
});
