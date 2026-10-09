import { inflateRawSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';
import type { ChronologyEvent, MedicalSpecials } from '../types';
import type { CreateDemandLetterDto } from './create-demand-letter.dto';
import { buildDemandLetterContent } from './demand-letter.content';
import { renderDemandLetter } from './demand-letter.docx';
import { DemandLetterService } from './demand-letter.service';
import {
  checkNarrative,
  chronologyNarrative,
  renderCitations,
} from './treatment-narrative';

function event(
  id: string,
  date: string,
  summary: string,
  extra: Partial<ChronologyEvent> = {},
): ChronologyEvent {
  return {
    id,
    date,
    type: 'office_visit',
    summary,
    diagnoses: [],
    treatments: [],
    medications: [],
    recordId: 'record-1',
    documentName: 'ER records.pdf',
    pageNumber: Number(id.slice(4)) + 1,
    batesNumbers: [],
    quote: summary,
    quoteVerified: true,
    ...extra,
  };
}

const events = [
  event(
    'rec-1',
    '2024-08-14',
    'Seen in the emergency department after a rear-end collision; CT head negative.',
    {
      type: 'emergency',
      facility: 'St. Mary Hospital',
      diagnoses: [{ description: 'Concussion', icd10: 'S06.0X0A' }],
    },
  ),
  event('rec-2', '2024-09-03', 'Neurology visit for persistent headaches.', {
    provider: 'Dr. Alan Reyes',
    documentName: 'Neuro.pdf',
    batesNumbers: ['RN-0002'],
  }),
];

const specials: MedicalSpecials = {
  status: 'completed',
  charges: [],
  providers: [
    {
      provider: 'St. Mary Hospital',
      firstDate: '2024-08-14',
      lastDate: '2024-08-14',
      billed: 4282.5,
      billedFrom: 'charges',
      chargeCount: 3,
      printedTotals: [],
    },
    {
      provider: 'Reyes Neurology PC',
      firstDate: '2024-09-03',
      lastDate: '2024-10-01',
      billed: 830,
      billedFrom: 'charges',
      chargeCount: 2,
      printedTotals: [],
    },
  ],
  totalBilled: 5112.5,
  billPages: [],
  unbilledProviders: [
    {
      provider: 'Bayside Physical Therapy',
      firstDate: '2024-09-10',
      lastDate: '2024-10-01',
      visits: 2,
      chronologyIds: ['rec-3', 'rec-4'],
    },
  ],
  warnings: [],
  generatedAt: '2026-10-09T00:00:00.000Z',
};

const dto: CreateDemandLetterDto = {
  clientName: 'Jane Doe',
  recipientName: 'Pat Adjuster',
  recipientCompany: 'Acme Insurance',
  recipientAddress: 'PO Box 1\nPhoenix, AZ 85001',
  claimNumber: 'CL-123',
  insuredName: 'John Driver',
  incidentDescription:
    'Your insured rear-ended our client at a red light.\n\nThe police report cites your insured for following too closely.',
  lostWages: 2400,
  lostWagesNote: 'Three weeks of missed work.',
  demandAmount: 45000,
  attorneyName: 'Alex Counsel',
  firmName: 'Counsel Law PLLC',
  firmAddress: '1 Main St\nPhoenix, AZ 85004',
  attorneyPhone: '602-555-0100',
};

const result = {
  chronology: {
    status: 'completed' as const,
    documents: [
      {
        recordId: 'record-1',
        documentName: 'ER records.pdf',
        pageCount: 4,
        unreadablePages: [],
      },
      {
        recordId: 'record-2',
        documentName: 'Neuro.pdf',
        pageCount: 2,
        unreadablePages: [],
      },
    ],
    events,
    pagesProcessed: 6,
    warnings: [],
    generatedAt: '2026-10-09T00:00:00.000Z',
  },
  medicalSpecials: specials,
};

/** word/document.xml of a .docx, as plain text with one line per paragraph. */
function documentText(buffer: Buffer): string {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === 'word/document.xml') {
      const size = buffer.readUInt32LE(offset + 20);
      const method = buffer.readUInt16LE(offset + 10);
      const start =
        local +
        30 +
        buffer.readUInt16LE(local + 26) +
        buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      const xml = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
      return xml
        .replace(/<w:p[ >]/g, '\n$&')
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'");
    }
    offset += 46 + nameLength + extra + comment;
  }
  throw new Error('word/document.xml not found');
}

describe('treatment narrative', () => {
  it('accepts a draft whose every paragraph is traceable', () => {
    expect(
      checkNarrative(
        [
          'On August 14, 2024, Jane Doe was treated for a concussion (S06.0X0A) [rec-1].',
          'In September 2024 she saw a neurologist for headaches [rec-2].',
        ],
        events,
        '2024-08-14',
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    ['an unknown entry', 'Jane had surgery [rec-9].', 'unknown entry rec-9'],
    [
      'no citation',
      'Jane was treated after the collision.',
      'a paragraph cites no entry',
    ],
    [
      'a dollar amount',
      'The visit cost $4,282.50 [rec-1].',
      'mentions a dollar amount',
    ],
    [
      'a date not in the records',
      'On March 3, 2025, Jane had an MRI [rec-2].',
      'date 2025-03-03',
    ],
    [
      'a code not in the records',
      'She was diagnosed with M54.2 [rec-2].',
      'code M54.2',
    ],
  ])('rejects a draft with %s', (_, paragraph, reason) => {
    expect(checkNarrative([paragraph], events, '2024-08-14')).toEqual({
      ok: false,
      reason,
    });
  });

  it('writes the citations out as record pages', () => {
    const byId = new Map(events.map((e) => [e.id, e]));
    expect(
      renderCitations('Jane went to the emergency department [rec-1].', byId),
    ).toBe('Jane went to the emergency department (ER records, p. 2).');
    expect(
      renderCitations(
        'Headaches continued. [rec-1][rec-2] She improved.',
        byId,
      ),
    ).toBe(
      'Headaches continued (ER records, p. 2; Neuro, p. 3, Bates RN-0002). She improved.',
    );
    // A citation that repeats the one before it is "Id.".
    expect(
      renderCitations(
        'Jane was seen [rec-1]. A CT was negative [rec-1]. Headaches continued [rec-2].',
        byId,
      ),
    ).toBe(
      'Jane was seen (ER records, p. 2). A CT was negative (Id.). Headaches continued (Neuro, p. 3, Bates RN-0002).',
    );
  });

  it('lists the entries when there is no usable draft', () => {
    expect(chronologyNarrative(events)).toEqual([
      'August 14, 2024 — St. Mary Hospital: Seen in the emergency department after a rear-end collision; CT head negative (ER records, p. 2).',
      'September 3, 2024 — Dr. Alan Reyes: Neurology visit for persistent headaches (Neuro, p. 3, Bates RN-0002).',
    ]);
    const many = Array.from({ length: 45 }, (_, i) =>
      event(`rec-${i + 1}`, '2024-09-01', `Therapy visit ${i + 1}.`),
    );
    const listed = chronologyNarrative(many);
    expect(listed).toHaveLength(41);
    expect(listed[40]).toBe(
      'Further treatment is documented in the enclosed records (5 more entries).',
    );
  });
});

describe('demand letter content', () => {
  const content = buildDemandLetterContent({
    dto,
    accidentDate: '2024-08-14',
    result,
    treatment: ['Treated on August 14, 2024 (ER records, p. 2).'],
    today: '2026-10-09',
  });
  const section = (heading: string) =>
    content.sections.find((s) => s.heading === heading);

  it('addresses the claim', () => {
    expect(content.letterhead).toEqual({
      firm: 'Counsel Law PLLC',
      lines: ['1 Main St', 'Phoenix, AZ 85004', '602-555-0100'],
    });
    expect(content.recipient).toEqual([
      'Pat Adjuster',
      'Acme Insurance',
      'PO Box 1',
      'Phoenix, AZ 85001',
    ]);
    expect(content.re).toEqual([
      { label: 'Our client', value: 'Jane Doe' },
      { label: 'Your insured', value: 'John Driver' },
      { label: 'Claim number', value: 'CL-123' },
      { label: 'Date of loss', value: 'August 14, 2024' },
    ]);
    expect(content.salutation).toBe('Dear Pat Adjuster:');
    expect(content.intro[0]).toBe(
      'This firm represents Jane Doe for injuries suffered on August 14, 2024, in an incident involving your insured, John Driver. Please direct all further communication about this claim to this office.',
    );
    expect(section('Facts of the Incident')?.paragraphs).toHaveLength(2);
    // A note the attorney typed reads as a sentence.
    expect(section('Other Economic Damages')?.paragraphs).toEqual([
      'Jane Doe lost wages of $2,400.00 because of the injuries. Three weeks of missed work.',
    ]);
  });

  it('writes names printed in capitals in normal case', () => {
    const shouting = buildDemandLetterContent({
      dto: { ...dto, insuredName: undefined, lostWagesNote: 'three weeks off' },
      accidentDate: '2024-08-14',
      result: {
        medicalSpecials: {
          ...specials,
          providers: [
            { ...specials.providers[0], provider: 'ST. MARY HOSPITAL' },
          ],
          unbilledProviders: [
            {
              ...specials.unbilledProviders[0],
              provider: 'BAYSIDE PHYSICAL THERAPY, LLC',
            },
          ],
        },
      },
      treatment: [],
      today: '2026-10-09',
    });
    const medical = shouting.sections.find(
      (s) => s.heading === 'Medical Expenses',
    );
    expect(medical?.table?.rows[0][0]).toBe('St. Mary Hospital');
    expect(medical?.after).toEqual([
      'Bills from Bayside Physical Therapy, LLC have been requested and will be provided when received.',
    ]);
    expect(shouting.intro[0]).toMatch(
      /^This firm represents Jane Doe for injuries suffered on August 14, 2024\. Please/,
    );
    expect(
      shouting.sections.find((s) => s.heading === 'Other Economic Damages')
        ?.paragraphs,
    ).toEqual([
      'Jane Doe lost wages of $2,400.00 because of the injuries. Three weeks off.',
    ]);
  });

  it('itemizes the bills and names the bills still to come', () => {
    const medical = section('Medical Expenses');
    expect(medical?.table?.rows).toEqual([
      ['St. Mary Hospital', 'August 14, 2024', '$4,282.50'],
      ['Reyes Neurology PC', 'September 3, 2024 – October 1, 2024', '$830.00'],
    ]);
    expect(medical?.table?.totalRow).toEqual(['Total', '', '$5,112.50']);
    expect(medical?.after).toEqual([
      'Bills from Bayside Physical Therapy have been requested and will be provided when received.',
    ]);
  });

  it('adds up the economic damages and sets the deadline', () => {
    expect(section('Damages')?.table?.rows).toEqual([
      ['Medical expenses billed to date', '$5,112.50'],
      ['Lost wages', '$2,400.00'],
    ]);
    expect(section('Damages')?.table?.totalRow).toEqual([
      'Total economic damages',
      '$7,512.50',
    ]);
    expect(section('Settlement Demand')?.paragraphs).toEqual([
      'To resolve this claim, Jane Doe demands $45,000.00.',
      'This offer will remain open until November 8, 2026, 30 days from the date of this letter. Please respond in writing by then.',
    ]);
    expect(content.enclosures).toEqual(['ER records.pdf', 'Neuro.pdf']);
  });

  it('says the bills will follow when none were read', () => {
    const noBills = buildDemandLetterContent({
      dto: { ...dto, lostWages: undefined, recipientName: undefined },
      accidentDate: '2024-08-14',
      result: { chronology: undefined, medicalSpecials: undefined },
      treatment: [],
      today: '2026-10-09',
    });
    const medical = noBills.sections.find(
      (s) => s.heading === 'Medical Expenses',
    );
    expect(medical?.table).toBeUndefined();
    expect(medical?.paragraphs).toEqual([
      "Itemized bills for Jane Doe's treatment will be provided under separate cover.",
    ]);
    expect(noBills.salutation).toBe('Dear Claims Representative:');
    expect(
      noBills.sections.find((s) => s.heading === 'Injuries and Treatment')
        ?.paragraphs,
    ).toEqual([
      "Jane Doe's injuries and treatment are documented in the enclosed medical records.",
    ]);
  });

  it('renders a Word letter', async () => {
    const buffer = await renderDemandLetter(content);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const text = documentText(buffer);
    expect(text).toContain('CONFIDENTIAL SETTLEMENT COMMUNICATION');
    expect(text).toContain('Re:\tOur client: Jane Doe');
    expect(text).toContain('Reyes Neurology PC');
    expect(text).toContain('$5,112.50');
    expect(text).toContain(
      'To resolve this claim, Jane Doe demands $45,000.00.',
    );
    expect(text).toContain('Sincerely,');
  });
});

describe('DemandLetterService', () => {
  const detail = {
    status: 'completed',
    accidentDate: '2024-08-14',
    accidentType: 'Motor vehicle collision',
    diagnosis: 'Concussion',
    result,
  };
  const prompts = {
    load: jest
      .fn()
      .mockResolvedValue('{{clientName}} {{dateOfLoss}}\n{{chronology}}'),
    render: (template: string, values: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? ''),
  };

  function build(reply: string, history = detail) {
    const complete = jest.fn().mockResolvedValue({ content: reply });
    const service = new DemandLetterService(
      { getHistory: jest.fn().mockResolvedValue(history) } as never,
      { complete } as never,
      prompts as never,
    );
    return { service, complete };
  }

  const grounded = JSON.stringify({
    paragraphs: [
      'On August 14, 2024, Jane Doe was treated in the emergency department of St. Mary Hospital [rec-1].',
      'On September 3, 2024, she saw Dr. Alan Reyes for persistent headaches [rec-2].',
    ],
  });

  it('uses a checked AI draft for the treatment section', async () => {
    const { service, complete } = build(grounded);
    const letter = await service.build('case-1', 'user-1', dto, '2026-10-09');
    expect(letter.treatmentSource).toBe('ai');
    expect(letter.fileName).toBe('demand-letter-jane-doe-2026-10-09.docx');
    const [[request]] = complete.mock.calls as Array<
      [{ messages: Array<{ content: string }> }]
    >;
    expect(request.messages[1].content).toContain('Jane Doe August 14, 2024');
    expect(request.messages[1].content).toContain('- rec-1 | 2024-08-14');
    expect(documentText(letter.buffer)).toContain(
      'emergency department of St. Mary Hospital (ER records, p. 2).',
    );
  });

  it('lists the chronology when the draft cannot be traced', async () => {
    const { service } = build(
      JSON.stringify({ paragraphs: ['Jane had spine surgery [rec-7].'] }),
    );
    const letter = await service.build('case-1', 'user-1', dto, '2026-10-09');
    expect(letter.treatmentSource).toBe('chronology');
    expect(documentText(letter.buffer)).toContain(
      'September 3, 2024 — Dr. Alan Reyes: Neurology visit for persistent headaches',
    );
  });

  it('skips the AI when asked', async () => {
    const { service, complete } = build(grounded);
    const letter = await service.build(
      'case-1',
      'user-1',
      { ...dto, useAi: false },
      '2026-10-09',
    );
    expect(complete).not.toHaveBeenCalled();
    expect(letter.treatmentSource).toBe('chronology');
  });

  it('refuses an analysis that has not finished', async () => {
    const { service } = build(grounded, {
      ...detail,
      status: 'running',
      result: null as never,
    });
    await expect(service.build('case-1', 'user-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
