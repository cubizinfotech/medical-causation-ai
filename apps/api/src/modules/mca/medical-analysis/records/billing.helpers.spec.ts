import type { ChronologyEvent } from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import type { ChronologyBatch } from './chronology.helpers';
import {
  amountPrintedOn,
  buildBillingBatches,
  finalizeSpecials,
  findUnbilledProviders,
  isBillPage,
  parseAmount,
  parseBillingResponse,
  validateBilling,
} from './billing.helpers';
import { BillingExtractionService } from './billing-extraction.service';

const HOSPITAL_BILL = [
  'ST. MARY HOSPITAL',
  'Itemized Statement    Account No. 55501',
  'Date of Service  Rev Code  CPT  Description  Charges',
  '08/14/2024  0450  99285  ER VISIT LEVEL 5  2,450.00',
  '08/14/2024  0350  70450  CT HEAD W/O CONTRAST  1,820.00',
  '08/14/2024  0250  IBUPROFEN 600 MG  12.50',
  'Total Charges  4,282.50',
  'Insurance Payments  1,100.00',
  'Adjustments  900.00',
  'Balance Due  2,282.50',
].join('\n');

const NEUROLOGY_BILL = [
  'REYES NEUROLOGY PC',
  'Statement',
  'DOS 09/03/24  99204  New patient visit  $350.00',
  'DOS 09/03/24  95886  EMG  $480.00',
  'Total charges $830.00',
].join('\n');

const CLINIC_NOTE =
  'Patient seen for neck pain after the collision. Copay $25 collected. BP 120/80, temperature 98.60. Follow up in 2 weeks.';

function batch(
  pages: Array<{ pageNumber: number; text: string; ocr?: boolean }>,
  recordId = 'rec-a',
  documentName = 'bills.pdf',
): ChronologyBatch {
  return {
    recordId,
    documentName,
    pages: pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
      batesNumbers: [],
      ...(page.ocr ? { ocrConfidence: 82 } : {}),
    })),
  };
}

const hospitalReply = {
  charges: [
    {
      page: 1,
      provider: 'St. Mary Hospital',
      dateOfService: '08/14/2024',
      description: 'ER visit level 5',
      code: '99285',
      amount: '2,450.00',
      quote: '08/14/2024 0450 99285 ER VISIT LEVEL 5 2,450.00',
    },
    {
      page: 1,
      provider: 'St. Mary Hospital',
      dateOfService: '08/14/2024',
      description: 'CT head without contrast',
      code: '70450',
      amount: '1,820.00',
      quote: '08/14/2024 0350 70450 CT HEAD W/O CONTRAST 1,820.00',
    },
    {
      page: 1,
      provider: '',
      dateOfService: '08/14/2024',
      description: 'Ibuprofen 600 mg',
      code: 'J1234',
      amount: '12.50',
      quote: '08/14/2024 0250 IBUPROFEN 600 MG 12.50',
    },
    {
      page: 1,
      provider: 'St. Mary Hospital',
      dateOfService: '08/14/2024',
      description: 'MRI brain',
      amount: '3,000.00',
      quote: 'MRI BRAIN 3,000.00',
    },
    {
      page: 1,
      provider: 'St. Mary Hospital',
      description: 'Total Charges',
      amount: '4,282.50',
      quote: 'Total Charges 4,282.50',
    },
  ],
  totals: [
    {
      page: 1,
      provider: 'St. Mary Hospital',
      kind: 'total_charges',
      amount: '4,282.50',
      quote: 'Total Charges 4,282.50',
    },
    {
      page: 1,
      provider: 'St. Mary Hospital',
      kind: 'payments',
      amount: '1,100.00',
      quote: 'Insurance Payments 1,100.00',
    },
    {
      page: 1,
      provider: 'St. Mary Hospital',
      kind: 'balance',
      amount: '2,282.50',
      quote: 'Balance Due 2,282.50',
    },
  ],
};

describe('bill pages', () => {
  it('finds bills, not clinical notes or lab values', () => {
    expect(isBillPage(HOSPITAL_BILL)).toBe(true);
    expect(isBillPage(NEUROLOGY_BILL)).toBe(true);
    expect(isBillPage(CLINIC_NOTE)).toBe(false);
    expect(
      isBillPage(
        'Hemoglobin 13.50 g/dL. Glucose 98.00 mg/dL. Sodium 138.00. Potassium 4.10.',
      ),
    ).toBe(false);
  });

  it('batches only the bill pages of each record', () => {
    const record: LoadedCaseRecord = {
      id: 'rec-a',
      name: 'records.pdf',
      pageCount: 3,
      unreadablePages: [],
      ocrPages: [],
      pages: [
        { pageNumber: 1, text: HOSPITAL_BILL, batesNumbers: [] },
        { pageNumber: 2, text: CLINIC_NOTE, batesNumbers: [] },
        { pageNumber: 3, text: NEUROLOGY_BILL, batesNumbers: [] },
      ],
    };
    const batches = buildBillingBatches([record], 5000);
    expect(batches.map((b) => b.pages.map((p) => p.pageNumber))).toEqual([
      [1, 3],
    ]);
  });
});

describe('amounts', () => {
  it('parses printed amounts and rejects anything else', () => {
    expect(parseAmount('$1,250.00')).toEqual({
      cents: 125000,
      text: '1,250.00',
    });
    expect(parseAmount('(85.00)')).toEqual({ cents: 8500, text: '85.00' });
    expect(parseAmount('about 85')).toBeNull();
    expect(parseAmount('0.00')).toBeNull();
  });

  it('finds an amount on the page in any common printing', () => {
    expect(amountPrintedOn(125000, 'Charge 1250.00 due')).toBe(true);
    expect(amountPrintedOn(125000, 'Charge $1,250 due')).toBe(true);
    expect(amountPrintedOn(125000, 'Charge 11,250.00 due')).toBe(false);
    expect(amountPrintedOn(125000, 'Charge 1,250.50 due')).toBe(false);
    expect(amountPrintedOn(8500, 'Copay 85 mg')).toBe(false);
    // OCR read the zeros as letters.
    expect(amountPrintedOn(125000, 'Charge 1,25O.OO', { ocr: true })).toBe(
      true,
    );
    expect(amountPrintedOn(125000, 'Charge 1,25O.OO')).toBe(false);
  });
});

describe('reading the reply', () => {
  it('keeps the complete entries of a reply that was cut off', () => {
    const reply =
      '{"charges": [{"page": 1, "amount": "2,450.00", "quote": "x {y}"}, {"page": 1, "amount": "1,8';
    const parsed = parseBillingResponse(reply);
    expect(parsed.truncated).toBe(true);
    expect(parsed.charges).toEqual([
      { page: 1, amount: '2,450.00', quote: 'x {y}' },
    ]);
  });

  it('keeps printed amounts, dates, and codes only', () => {
    const draft = validateBilling(
      hospitalReply,
      batch([{ pageNumber: 1, text: HOSPITAL_BILL }]),
    );
    // The MRI line is not on the page.
    expect(draft.dropped).toBe(1);
    expect(draft.charges.map((c) => [c.description, c.amount, c.code])).toEqual(
      [
        ['ER visit level 5', 2450, '99285'],
        ['CT head without contrast', 1820, '70450'],
        ['Ibuprofen 600 mg', 12.5, undefined],
        ['Total Charges', 4282.5, undefined],
      ],
    );
    expect(draft.charges[0]).toMatchObject({
      dateOfService: '2024-08-14',
      quoteVerified: true,
      pageNumber: 1,
    });
    expect(draft.totals.map((t) => t.kind)).toEqual([
      'total_charges',
      'payments',
      'balance',
    ]);
  });

  it('reads two-digit years and blanks dates that are not printed', () => {
    const page = batch([{ pageNumber: 4, text: NEUROLOGY_BILL }]);
    const draft = validateBilling(
      {
        charges: [
          {
            page: 4,
            dateOfService: '09/03/24',
            amount: '$350.00',
            quote: 'DOS 09/03/24 99204 New patient visit $350.00',
          },
          {
            page: 4,
            dateOfService: '2024-09-05',
            amount: '480.00',
            quote: 'DOS 09/03/24 95886 EMG $480.00',
          },
        ],
        totals: [],
      },
      page,
    );
    expect(draft.charges.map((c) => c.dateOfService)).toEqual([
      '2024-09-03',
      '',
    ]);
  });
});

describe('the ledger', () => {
  const hospital = validateBilling(
    hospitalReply,
    batch([{ pageNumber: 1, text: HOSPITAL_BILL }]),
  );
  const neurology = validateBilling(
    {
      charges: [
        {
          page: 3,
          provider: 'Reyes Neurology PC',
          dateOfService: '09/03/24',
          description: 'New patient visit',
          code: '99204',
          amount: '$350.00',
          quote: 'DOS 09/03/24 99204 New patient visit $350.00',
        },
        {
          page: 3,
          provider: 'Reyes Neurology PC',
          dateOfService: '09/03/24',
          description: 'EMG',
          code: '95886',
          amount: '$480.00',
          quote: 'DOS 09/03/24 95886 EMG $480.00',
        },
      ],
      totals: [
        {
          page: 3,
          provider: 'Reyes Neurology PC',
          kind: 'total_charges',
          amount: '$830.00',
          quote: 'Total charges $830.00',
        },
      ],
    },
    batch([{ pageNumber: 3, text: NEUROLOGY_BILL }]),
  );
  // The hospital bill was included again in a second record.
  const copy = validateBilling(
    { charges: [hospitalReply.charges[0]], totals: [] },
    batch([{ pageNumber: 7, text: HOSPITAL_BILL }], 'rec-b', 'er-packet.pdf'),
  );

  const events = [
    {
      id: 'rec-1',
      date: '2024-08-14',
      type: 'emergency',
      facility: 'St. Mary Emergency Department',
    },
    {
      id: 'rec-2',
      date: '2024-09-03',
      type: 'office_visit',
      provider: 'Dr. Alan Reyes',
    },
    {
      id: 'rec-3',
      date: '2024-09-10',
      type: 'therapy',
      facility: 'Bayside Physical Therapy',
    },
    {
      id: 'rec-4',
      date: '2024-10-01',
      type: 'therapy',
      facility: 'Bayside Physical Therapy',
    },
    {
      id: 'rec-5',
      date: '2024-09-03',
      type: 'medication',
      facility: 'CVS Pharmacy',
    },
  ] as ChronologyEvent[];

  const specials = finalizeSpecials({
    drafts: [hospital, neurology, copy],
    records: [
      { id: 'rec-a', name: 'bills.pdf' },
      { id: 'rec-b', name: 'er-packet.pdf' },
    ],
    billPages: [
      { recordId: 'rec-a', documentName: 'bills.pdf', pages: [1, 3] },
    ],
    events,
    totalBatches: 2,
  });

  it('totals each provider from its lines, counting a repeated page once', () => {
    expect(specials.status).toBe('completed');
    expect(
      specials.providers.map((p) => [p.provider, p.billed, p.chargeCount]),
    ).toEqual([
      ['St. Mary Hospital', 4282.5, 3],
      ['Reyes Neurology PC', 830, 2],
    ]);
    expect(specials.totalBilled).toBe(5112.5);
    const duplicate = specials.charges.find((c) => c.recordId === 'rec-b');
    expect(duplicate?.duplicateOf).toBe('chg-1');
    // The "Total Charges" line was a total, not a charge.
    expect(
      specials.charges.some((c) => c.description === 'Total Charges'),
    ).toBe(false);
    // A line without a provider takes the one named on its page.
    expect(specials.charges.find((c) => c.amount === 12.5)?.provider).toBe(
      'St. Mary Hospital',
    );
    expect(specials.charges.map((c) => c.id).slice(0, 2)).toEqual([
      'chg-1',
      'chg-2',
    ]);
    expect(specials.providers[0].printedTotals.map((t) => t.kind)).toEqual([
      'total_charges',
      'payments',
      'balance',
    ]);
    expect(specials.providers[0].mismatch).toBeUndefined();
    expect(specials.warnings).toEqual(
      expect.arrayContaining([
        '1 charge(s) appear on more than one page and were counted once.',
        '1 line(s) the AI listed were left out because the amount is not printed on the cited page.',
      ]),
    );
  });

  it('lists treating providers with no bill, matched by name', () => {
    expect(specials.unbilledProviders).toEqual([
      {
        provider: 'Bayside Physical Therapy',
        firstDate: '2024-09-10',
        lastDate: '2024-10-01',
        visits: 2,
        chronologyIds: ['rec-3', 'rec-4'],
      },
    ]);
  });

  it('flags lines that do not add up to the printed total', () => {
    const partial = validateBilling(
      {
        charges: [hospitalReply.charges[0]],
        totals: [hospitalReply.totals[0]],
      },
      batch([{ pageNumber: 1, text: HOSPITAL_BILL }]),
    );
    const result = finalizeSpecials({
      drafts: [partial],
      records: [{ id: 'rec-a', name: 'bills.pdf' }],
      billPages: [{ recordId: 'rec-a', documentName: 'bills.pdf', pages: [1] }],
    });
    expect(result.providers[0].mismatch).toEqual({
      printed: 4282.5,
      read: 2450,
      documentName: 'bills.pdf',
      pageNumber: 1,
    });
    expect(result.warnings[0]).toMatch(
      /add up to \$2,450\.00, but bills\.pdf p\. 1 prints total charges of \$4,282\.50/,
    );
  });

  it('uses the printed total when no lines were read', () => {
    const totalsOnly = validateBilling(
      { charges: [], totals: [hospitalReply.totals[0]] },
      batch([{ pageNumber: 1, text: HOSPITAL_BILL }]),
    );
    const result = finalizeSpecials({
      drafts: [totalsOnly],
      records: [{ id: 'rec-a', name: 'bills.pdf' }],
      billPages: [{ recordId: 'rec-a', documentName: 'bills.pdf', pages: [1] }],
    });
    expect(result.providers[0]).toMatchObject({
      billed: 4282.5,
      billedFrom: 'printed_total',
      chargeCount: 0,
    });
  });

  it('says when no page looked like a bill', () => {
    const none = finalizeSpecials({
      drafts: [],
      records: [{ id: 'rec-a', name: 'notes.pdf' }],
      billPages: [],
      events,
    });
    expect(none.status).toBe('no_bills');
    expect(none.totalBilled).toBe(0);
    // Every treating provider is a bill to request.
    expect(none.unbilledProviders.map((p) => p.provider)).toEqual([
      'St. Mary Emergency Department',
      'Dr. Alan Reyes',
      'Bayside Physical Therapy',
    ]);
  });

  it('matches providers on distinctive words only', () => {
    expect(
      findUnbilledProviders(
        [
          {
            id: 'rec-1',
            date: '',
            type: 'imaging',
            facility: 'Medical Imaging Center',
          },
        ] as ChronologyEvent[],
        ['Valley Medical Center'],
      ),
    ).toHaveLength(1);
  });
});

describe('BillingExtractionService', () => {
  const records: LoadedCaseRecord[] = [
    {
      id: 'rec-a',
      name: 'bills.pdf',
      pageCount: 2,
      unreadablePages: [],
      ocrPages: [],
      pages: [
        { pageNumber: 1, text: HOSPITAL_BILL, batesNumbers: [] },
        { pageNumber: 2, text: CLINIC_NOTE, batesNumbers: [] },
      ],
    },
    {
      id: 'rec-b',
      name: 'neuro.pdf',
      pageCount: 1,
      unreadablePages: [],
      ocrPages: [],
      pages: [{ pageNumber: 1, text: NEUROLOGY_BILL, batesNumbers: [] }],
    },
  ];
  const prompts = {
    load: jest.fn().mockResolvedValue('{{documentName}}\n{{pages}}'),
    render: (template: string, values: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? ''),
  };

  it('reads each bill batch and keeps going when one fails', async () => {
    const complete = jest
      .fn()
      .mockResolvedValueOnce({ content: JSON.stringify(hospitalReply) })
      .mockRejectedValueOnce(new Error('rate limited'));
    const service = new BillingExtractionService(
      { complete } as never,
      prompts as never,
    );
    const progress: string[] = [];
    const result = await service.build(records, [], (done, total) => {
      progress.push(`${done}/${total}`);
      return Promise.resolve();
    });

    expect(complete).toHaveBeenCalledTimes(2);
    const [[request]] = complete.mock.calls as Array<
      [{ maxTokens: number; messages: Array<{ content: string }> }]
    >;
    expect(request.maxTokens).toBe(8192);
    // Only the bill page is sent, not the clinical note.
    expect(request.messages[1].content).toContain('=== Page 1 ===');
    expect(request.messages[1].content).not.toContain('=== Page 2 ===');
    expect(progress).toEqual(['1/2', '2/2']);
    expect(result.status).toBe('partial');
    expect(result.totalBilled).toBe(4282.5);
    expect(result.billPages).toEqual([
      { recordId: 'rec-a', documentName: 'bills.pdf', pages: [1] },
      { recordId: 'rec-b', documentName: 'neuro.pdf', pages: [1] },
    ]);
    expect(result.warnings).toContain(
      'neuro.pdf: page 1 could not be read for charges and is missing from the bills summary.',
    );
  });

  it('makes no AI call when no page looks like a bill', async () => {
    const complete = jest.fn();
    const service = new BillingExtractionService(
      { complete } as never,
      prompts as never,
    );
    const result = await service.build([
      { ...records[0], pages: [records[0].pages[1]] },
    ]);
    expect(complete).not.toHaveBeenCalled();
    expect(result.status).toBe('no_bills');
  });
});
