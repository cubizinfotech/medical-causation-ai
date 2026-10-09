import type { ChronologyEvent, MedicalChronology } from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import { formatDefenseIssues } from '../builders/analysis-prompt.builder';
import { findDefenseIssues, findQuote, regionsOf } from './defense-issues';

let nextId = 1;
function event(
  date: string,
  type: ChronologyEvent['type'],
  summary: string,
  extra: Partial<ChronologyEvent> = {},
): ChronologyEvent {
  const id = `rec-${nextId++}`;
  return {
    id,
    date,
    type,
    summary,
    diagnoses: [],
    treatments: [],
    medications: [],
    recordId: 'record-1',
    documentName: 'records.pdf',
    pageNumber: nextId,
    batesNumbers: [],
    quote: summary,
    quoteVerified: true,
    ...extra,
  };
}

function chronology(events: ChronologyEvent[]): MedicalChronology {
  return {
    status: 'completed',
    documents: [],
    events,
    pagesProcessed: 10,
    warnings: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function records(pages: string[]): LoadedCaseRecord[] {
  return [
    {
      id: 'record-1',
      name: 'records.pdf',
      pageCount: pages.length,
      unreadablePages: [],
      ocrPages: [],
      pages: pages.map((text, index) => ({
        pageNumber: index + 1,
        text,
        batesNumbers: [],
      })),
    },
  ];
}

const request = {
  accidentDate: '2024-08-01',
  injury: 'Rear-end collision: whiplash and neck pain',
  diagnosis: 'Cervical strain',
  symptoms: 'Neck pain, headaches',
};

describe('defense issues', () => {
  beforeEach(() => {
    nextId = 1;
  });

  it('flags a late first visit and long gaps, citing the chronology', () => {
    const er = event('2024-08-24', 'emergency', 'ED visit for neck pain.', {
      facility: 'St. Mary ED',
    });
    const pt = event('2024-09-03', 'therapy', 'Physical therapy for neck.');
    const later = event('2025-01-10', 'office_visit', 'Neck pain persists.');
    const result = findDefenseIssues({
      request,
      chronology: chronology([er, pt, later]),
      records: records(['ED note']),
    });

    expect(result.status).toBe('completed');
    const delay = result.issues.find(
      (issue) => issue.kind === 'delayed_treatment',
    );
    expect(delay).toMatchObject({
      severity: 'high',
      title: 'First recorded treatment 23 days after the accident',
    });
    expect(delay?.detail).toContain(
      'emergency visit on Aug 24, 2024 (St. Mary ED)',
    );
    expect(delay?.evidence[0]).toMatchObject({
      chronologyId: er.id,
      source: 'record',
    });

    const gaps = result.issues.filter(
      (issue) => issue.kind === 'treatment_gap',
    );
    expect(gaps.map((gap) => gap.title)).toEqual([
      'Gap in treatment of 129 days',
    ]);
    expect(gaps[0].severity).toBe('high');
    expect(gaps[0].evidence.map((item) => item.chronologyId)).toEqual([
      pt.id,
      later.id,
    ]);
    // High-severity issues come first and ids follow that order.
    expect(result.issues[0].id).toBe('issue-1');
    expect(
      result.issues.every(
        (issue, index, list) =>
          index === 0 ||
          ['high', 'medium', 'low'].indexOf(list[index - 1].severity) <=
            ['high', 'medium', 'low'].indexOf(issue.severity),
      ),
    ).toBe(true);
  });

  it('does not flag prompt care or short gaps', () => {
    const result = findDefenseIssues({
      request,
      chronology: chronology([
        event('2024-08-01', 'emergency', 'ED visit same day.'),
        event('2024-08-20', 'office_visit', 'Follow-up.'),
        event('2024-09-25', 'therapy', 'Therapy.'),
      ]),
      records: records(['note']),
    });
    expect(
      result.issues.filter((issue) =>
        ['delayed_treatment', 'treatment_gap'].includes(issue.kind),
      ),
    ).toEqual([]);
  });

  it('finds earlier treatment of the same body area, not unrelated history', () => {
    const neck = event('2023-11-02', 'office_visit', 'Visit for neck pain.', {
      diagnoses: [{ description: 'Cervicalgia', icd10: 'M54.2' }],
    });
    const physical = event(
      '2022-03-01',
      'office_visit',
      'Annual physical; hypertension.',
    );
    const result = findDefenseIssues({
      request,
      chronology: chronology([
        neck,
        physical,
        event(
          '2024-08-02',
          'emergency',
          'ED visit for neck pain after the collision.',
        ),
      ]),
      records: records(['note']),
    });
    const prior = result.issues.find((issue) => issue.kind === 'pre_existing');
    expect(prior).toMatchObject({
      severity: 'high',
      title: 'Treatment of the neck before the accident',
    });
    expect(prior?.evidence.map((item) => item.chronologyId)).toEqual([neck.id]);
    expect(result.notes).toContain(
      '1 record entry dated before the accident involves other body areas.',
    );
  });

  it('quotes record text the defense will use and skips negated findings', () => {
    const result = findDefenseIssues({
      request,
      chronology: chronology([event('2024-08-02', 'emergency', 'ED visit.')]),
      records: records([
        'CT CERVICAL SPINE: No acute fracture. Mild degenerative disc disease at C5-C6 with small osteophytes. Impression: no acute findings.',
        'MRI LUMBAR: No degenerative changes. Normal alignment.',
        'Patient was a no-show for physical therapy on 10/12/2024. Rescheduled.',
        'Patient reports a second accident on 11/20/2024 while at work.',
        'Patient referred by attorney for evaluation of neck pain.',
      ]),
    });
    const byKind = new Map(result.issues.map((issue) => [issue.kind, issue]));

    const degenerative = byKind.get('degenerative');
    expect(degenerative?.severity).toBe('high');
    expect(degenerative?.evidence).toEqual([
      {
        source: 'record',
        recordId: 'record-1',
        documentName: 'records.pdf',
        pageNumber: 1,
        quote:
          'Mild degenerative disc disease at C5-C6 with small osteophytes.',
      },
    ]);
    expect(byKind.get('non_compliance')?.evidence[0].quote).toBe(
      'Patient was a no-show for physical therapy on 10/12/2024.',
    );
    expect(byKind.get('intervening_event')?.evidence[0].pageNumber).toBe(4);
    expect(byKind.get('attorney_involvement')).toMatchObject({
      severity: 'low',
      evidence: [expect.objectContaining({ pageNumber: 5 })],
    });
  });

  it('uses the prior history from the intake form', () => {
    const result = findDefenseIssues({
      request: {
        ...request,
        medicalHistory:
          'Prior History: Chronic neck pain since 2019, treated by chiropractor.\nMedications: ibuprofen',
      },
    });
    expect(result.status).toBe('limited');
    expect(result.notes[0]).toMatch(/No medical records were uploaded/);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: 'reported_history',
        severity: 'medium',
        title: 'Prior history reported for the neck',
        evidence: [
          {
            source: 'intake',
            quote: 'Chronic neck pain since 2019, treated by chiropractor.',
          },
        ],
      }),
    ]);
    expect(
      findDefenseIssues({
        request: { ...request, medicalHistory: 'Prior History: None' },
      }).issues,
    ).toEqual([]);
  });

  it('skips date checks without a full accident date', () => {
    const result = findDefenseIssues({
      request: { ...request, accidentDate: '' },
      chronology: chronology([event('2024-12-01', 'office_visit', 'Visit.')]),
      records: records(['note']),
    });
    expect(result.status).toBe('limited');
    expect(result.notes[0]).toMatch(/accident date is missing/);
    expect(result.issues).toEqual([]);
  });
});

describe('defense issues in the analysis prompt', () => {
  it('lists issues and cites only entries the model may cite', () => {
    const text = formatDefenseIssues(
      {
        status: 'completed',
        notes: [],
        issues: [
          {
            id: 'issue-1',
            kind: 'treatment_gap',
            severity: 'high',
            title: 'Gap in treatment of 129 days',
            detail: '',
            defenseArgument: '',
            response: '',
            evidence: [
              { source: 'record', chronologyId: 'rec-2', quote: 'a' },
              { source: 'record', chronologyId: 'rec-9', quote: 'b' },
            ],
          },
        ],
      },
      new Set(['rec-2']),
    );
    expect(text).toContain('- [high] Gap in treatment of 129 days (rec-2)');
    expect(text).not.toContain('rec-9');
    expect(formatDefenseIssues(undefined, new Set())).toBe('');
  });
});

describe('defense issue helpers', () => {
  it('maps text and codes to body areas', () => {
    expect([...regionsOf('Low back pain radiating to the leg')]).toEqual([
      'low back',
    ]);
    expect([...regionsOf('Follow-up', ['S06.0X1A'])]).toEqual([
      'head and brain',
    ]);
  });

  it('quotes a sentence exactly and ignores negated matches', () => {
    const text =
      'No pre-existing injury. Old fracture of the left wrist noted.';
    expect(findQuote(text, /\b(pre-?existing|old fracture)\b/i)).toBe(
      'Old fracture of the left wrist noted.',
    );
  });
});
