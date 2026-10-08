import {
  buildChronologyBatches,
  finalizeChronology,
  formatChronologyForPrompt,
  normalizeEventDate,
  parseChronologyResponse,
  validateChronologyEvents,
  verifiedIcd10,
  type ChronologyBatch,
} from './chronology.helpers';
import { formatPageList } from './chronology-extraction.service';
import type { LoadedCaseRecord } from './case-record.types';

const page3 =
  'EMERGENCY DEPARTMENT NOTE 08/14/2024. Patient reports brief loss of consciousness after rear-end collision. Diagnosis: Concussion with loss of consciousness S06.0X1A. CT head negative.';
const page4 =
  'Discharge instructions. Return if headache worsens. Acetaminophen 500 mg every 6 hours as needed. Follow up with neurology in one week.';

const batch: ChronologyBatch = {
  recordId: 'record-1',
  documentName: 'er-records.pdf',
  pages: [
    { pageNumber: 3, text: page3, batesNumbers: ['ABC000123'] },
    { pageNumber: 4, text: page4, batesNumbers: [] },
  ],
};

describe('chronology helpers', () => {
  it('keeps an ICD-10 code only when it is printed on the page', () => {
    expect(verifiedIcd10('S06.0X1A', page3)).toBe('S06.0X1A');
    expect(verifiedIcd10('s060x1a', page3)).toBe('S060X1A');
    // A plausible but invented code is dropped.
    expect(verifiedIcd10('I63.9', page3)).toBeUndefined();
    expect(verifiedIcd10('not a code', page3)).toBeUndefined();
  });

  it('normalizes dates and never guesses', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    expect(normalizeEventDate('2024-08-14', now)).toBe('2024-08-14');
    expect(normalizeEventDate('8/14/2024', now)).toBe('2024-08-14');
    expect(normalizeEventDate('2024-08', now)).toBe('2024-08');
    expect(normalizeEventDate('2024-02-30', now)).toBe('');
    expect(normalizeEventDate('2099-01-01', now)).toBe('');
    expect(normalizeEventDate('last spring', now)).toBe('');
  });

  it('reads events from a JSON reply with or without fences', () => {
    expect(
      parseChronologyResponse('```json\n{"events":[{"summary":"x"}]}\n```'),
    ).toEqual([{ summary: 'x' }]);
    expect(parseChronologyResponse('[{"summary":"y"}]')).toEqual([
      { summary: 'y' },
    ]);
    expect(() => parseChronologyResponse('no json')).toThrow();
  });

  it('verifies quotes and corrects the page when the quote is on another page', () => {
    const [event, moved, unverified] = validateChronologyEvents(
      [
        {
          date: '2024-08-14',
          type: 'emergency',
          facility: 'St. Mary ED',
          summary: 'ED visit after rear-end collision with brief LOC.',
          diagnoses: [
            { description: 'Concussion with LOC', icd10: 'S06.0X1A' },
            { description: 'Stroke', icd10: 'I63.9' },
          ],
          page: 3,
          quote: 'brief loss of consciousness after rear-end collision',
        },
        {
          date: '2024-08-14',
          type: 'medication',
          summary: 'Acetaminophen prescribed at discharge.',
          medications: ['Acetaminophen 500 mg'],
          page: 3,
          quote: 'Acetaminophen 500 mg every 6 hours as needed',
        },
        {
          date: '2024-08-14',
          type: 'office_visit',
          summary: 'Neurology follow-up advised.',
          page: 4,
          quote: 'patient seen by neurology and cleared to work',
        },
      ],
      batch,
      new Date('2026-10-08T00:00:00Z'),
    );

    expect(event).toMatchObject({
      pageNumber: 3,
      quoteVerified: true,
      batesNumbers: ['ABC000123'],
      diagnoses: [
        { description: 'Concussion with LOC', icd10: 'S06.0X1A' },
        { description: 'Stroke' },
      ],
    });
    // The quote is on page 4, not the claimed page 3.
    expect(moved).toMatchObject({ pageNumber: 4, quoteVerified: true });
    // A quote not found anywhere keeps the claimed page but is flagged.
    expect(unverified).toMatchObject({ pageNumber: 4, quoteVerified: false });
  });

  it('drops events that point outside the batch or have no summary', () => {
    expect(
      validateChronologyEvents(
        [
          { summary: 'Invented page', page: 99, quote: 'nothing like this' },
          { summary: '', page: 3 },
          'not an object',
        ],
        batch,
      ),
    ).toEqual([]);
  });

  it('sorts by date, puts undated events last, removes duplicates, and assigns ids', () => {
    const base = {
      type: 'office_visit' as const,
      diagnoses: [],
      treatments: [],
      medications: [],
      recordId: 'record-1',
      documentName: 'a.pdf',
      batesNumbers: [],
      quote: '',
      quoteVerified: true,
    };
    const events = finalizeChronology(
      [
        { ...base, date: '', summary: 'Undated note', pageNumber: 1 },
        {
          ...base,
          date: '2025-01-20',
          summary: 'Stroke admission',
          pageNumber: 9,
        },
        { ...base, date: '2024-08-14', summary: 'ER visit', pageNumber: 3 },
        { ...base, date: '2024-08-14', summary: 'ER visit', pageNumber: 3 },
      ],
      ['record-1'],
    );
    expect(events.map((e) => [e.id, e.summary])).toEqual([
      ['rec-1', 'ER visit'],
      ['rec-2', 'Stroke admission'],
      ['rec-3', 'Undated note'],
    ]);
  });

  it('keeps the most relevant events when the prompt budget is small', () => {
    const base = {
      type: 'office_visit' as const,
      diagnoses: [],
      treatments: [],
      medications: [],
      recordId: 'record-1',
      documentName: 'a.pdf',
      batesNumbers: [],
      quote: '',
      quoteVerified: true,
      pageNumber: 1,
    };
    const events = finalizeChronology(
      [
        { ...base, date: '2024-01-01', summary: 'Routine dental cleaning' },
        { ...base, date: '2024-08-14', summary: 'Concussion after collision' },
        { ...base, date: '2025-01-20', summary: 'Ischemic stroke admission' },
      ],
      ['record-1'],
    );
    const result = formatChronologyForPrompt(events, 230, [
      'concussion',
      'stroke',
    ]);
    expect(result.includedIds).toEqual(['rec-2', 'rec-3']);
    expect(result.omitted).toBe(1);
    // Kept events stay in date order.
    expect(result.text.indexOf('rec-2')).toBeLessThan(
      result.text.indexOf('rec-3'),
    );
  });

  it('batches readable pages per record and skips scanned pages', () => {
    const record = (id: string, texts: string[]): LoadedCaseRecord => ({
      id,
      name: `${id}.pdf`,
      pageCount: texts.length,
      unreadablePages: [],
      pages: texts.map((text, i) => ({
        pageNumber: i + 1,
        text,
        batesNumbers: [],
      })),
    });
    const long = 'x'.repeat(60);
    const batches = buildChronologyBatches(
      [record('a', [long, '', long, long]), record('b', [long])],
      130,
    );
    expect(
      batches.map((b) => [b.recordId, b.pages.map((p) => p.pageNumber)]),
    ).toEqual([
      ['a', [1, 3]],
      ['a', [4]],
      ['b', [1]],
    ]);
  });

  it('formats page lists as ranges', () => {
    expect(formatPageList([9, 1, 2, 3, 7, 10])).toBe('1–3, 7, 9–10');
  });
});
