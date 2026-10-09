import type { MedicalAnalysisResult } from '../types';
import type { CreateDemandLetterDto } from './create-demand-letter.dto';
import {
  addDays,
  asSentence,
  displayName,
  formatEventDateLong,
  formatUsd,
  linesOf,
  paragraphsOf,
} from './letter-format';

export interface LetterTable {
  columns: string[];
  rows: string[][];
  totalRow?: string[];
  /** Indexes of the amount columns, aligned right. */
  amountColumns: number[];
}

export interface LetterSection {
  heading: string;
  paragraphs: string[];
  table?: LetterTable;
  /** Paragraphs after the table. */
  after?: string[];
}

export interface DemandLetterContent {
  letterDate: string;
  letterhead: { firm: string; lines: string[] };
  recipient: string[];
  re: Array<{ label: string; value: string }>;
  salutation: string;
  intro: string[];
  sections: LetterSection[];
  closing: string[];
  signature: string[];
  enclosures: string[];
}

export interface DemandLetterInput {
  dto: CreateDemandLetterDto;
  /** The case's accident date, used when the form gives no date of loss. */
  accidentDate: string;
  result: Pick<MedicalAnalysisResult, 'chronology' | 'medicalSpecials'>;
  /** The "Injuries and Treatment" paragraphs, citations already written out. */
  treatment: string[];
  /** YYYY-MM-DD */
  today: string;
}

const ISO_DATE = /^\d{4}-\d{2}(?:-\d{2})?$/;

function longDate(value: string): string {
  return ISO_DATE.test(value) ? formatEventDateLong(value) : value;
}

/** Joins names: "A", "A and B", "A, B, and C". */
function listOf(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * The letter's text, from the analysis and what the attorney entered. Every
 * figure comes from the bills summary or the form; nothing is estimated.
 */
export function buildDemandLetterContent(
  input: DemandLetterInput,
): DemandLetterContent {
  const { dto, result } = input;
  const client = dto.clientName.trim();
  const dateOfLoss = (dto.dateOfLoss ?? input.accidentDate ?? '').trim();
  const responseDays = dto.responseDays ?? 30;
  const specials = result.medicalSpecials;

  const contact = [dto.attorneyPhone, dto.attorneyEmail]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ');
  const letterhead = {
    firm: dto.firmName?.trim() || dto.attorneyName.trim(),
    lines: [...linesOf(dto.firmAddress), ...(contact ? [contact] : [])],
  };

  const re = [
    { label: 'Our client', value: client },
    ...(dto.insuredName?.trim()
      ? [{ label: 'Your insured', value: dto.insuredName.trim() }]
      : []),
    ...(dto.claimNumber?.trim()
      ? [{ label: 'Claim number', value: dto.claimNumber.trim() }]
      : []),
    ...(dateOfLoss
      ? [{ label: 'Date of loss', value: longDate(dateOfLoss) }]
      : []),
  ];

  const intro = [
    `This firm represents ${client} for injuries suffered${dateOfLoss ? ` on ${longDate(dateOfLoss)},` : ''}${dto.insuredName?.trim() ? ` in an incident involving your insured, ${dto.insuredName.trim()}` : ''}`.replace(
      /,$/,
      '',
    ) +
      '. Please direct all further communication about this claim to this office.',
    `This letter sets out the facts of the incident, ${client}'s injuries and treatment, and the damages to date, and makes an offer to settle the claim.`,
  ];

  const sections: LetterSection[] = [
    {
      heading: 'Facts of the Incident',
      paragraphs: paragraphsOf(dto.incidentDescription),
    },
    {
      heading: 'Injuries and Treatment',
      paragraphs:
        input.treatment.length > 0
          ? input.treatment
          : [
              `${client}'s injuries and treatment are documented in the enclosed medical records.`,
            ],
    },
  ];

  // Medical expenses: the bills summary, provider by provider.
  const billed = (specials?.providers ?? []).filter(
    (provider) => provider.billed > 0,
  );
  const medicalTotal =
    billed.reduce(
      (sum, provider) => sum + Math.round(provider.billed * 100),
      0,
    ) / 100;
  const pending = (specials?.unbilledProviders ?? []).map((provider) =>
    displayName(provider.provider),
  );
  const pendingNote =
    pending.length > 0
      ? [
          `Bills from ${listOf(pending)} have been requested and will be provided when received.`,
        ]
      : [];
  if (billed.length > 0) {
    sections.push({
      heading: 'Medical Expenses',
      paragraphs: [
        `${client}'s medical bills to date, as itemized in the enclosed records, are as follows:`,
      ],
      table: {
        columns: ['Provider', 'Dates of service', 'Amount billed'],
        rows: billed.map((provider) => [
          displayName(provider.provider),
          provider.firstDate
            ? provider.firstDate === provider.lastDate
              ? formatEventDateLong(provider.firstDate)
              : `${formatEventDateLong(provider.firstDate)} – ${formatEventDateLong(provider.lastDate)}`
            : '—',
          formatUsd(provider.billed),
        ]),
        totalRow: ['Total', '', formatUsd(medicalTotal)],
        amountColumns: [2],
      },
      after: pendingNote,
    });
  } else {
    sections.push({
      heading: 'Medical Expenses',
      paragraphs: [
        `Itemized bills for ${client}'s treatment will be provided under separate cover.`,
        ...pendingNote,
      ],
    });
  }

  const lostWages = dto.lostWages ?? 0;
  const futureMedical = dto.futureMedical ?? 0;
  const other: string[] = [];
  if (lostWages > 0) {
    other.push(
      `${client} lost wages of ${formatUsd(lostWages)} because of the injuries. ${asSentence(dto.lostWagesNote ?? '')}`.trim(),
    );
  }
  if (futureMedical > 0) {
    other.push(
      `Future medical care is estimated at ${formatUsd(futureMedical)}. ${asSentence(dto.futureMedicalNote ?? '')}`.trim(),
    );
  }
  if (other.length > 0) {
    sections.push({ heading: 'Other Economic Damages', paragraphs: other });
  }

  const summaryRows: string[][] = [
    ...(medicalTotal > 0
      ? [['Medical expenses billed to date', formatUsd(medicalTotal)]]
      : []),
    ...(lostWages > 0 ? [['Lost wages', formatUsd(lostWages)]] : []),
    ...(futureMedical > 0
      ? [['Future medical care (estimated)', formatUsd(futureMedical)]]
      : []),
  ];
  const economicTotal =
    (Math.round(medicalTotal * 100) +
      Math.round(lostWages * 100) +
      Math.round(futureMedical * 100)) /
    100;
  sections.push({
    heading: 'Damages',
    paragraphs:
      summaryRows.length > 0
        ? [`${client}'s economic damages to date are:`]
        : [],
    ...(summaryRows.length > 0
      ? {
          table: {
            columns: ['', 'Amount'],
            rows: summaryRows,
            totalRow: ['Total economic damages', formatUsd(economicTotal)],
            amountColumns: [1],
          },
        }
      : {}),
    after: [
      `In addition to these economic losses, ${client} is entitled to compensation for the pain, limitations, and disruption of daily life that followed the incident, as reflected in the treatment described above.`,
    ],
  });

  const deadline = addDays(input.today, responseDays);
  sections.push({
    heading: 'Settlement Demand',
    paragraphs: [
      `To resolve this claim, ${client} demands ${formatUsd(dto.demandAmount)}.${dto.policyLimits ? ` We understand the applicable policy limits to be ${formatUsd(dto.policyLimits)}.` : ''}`,
      `This offer will remain open until ${formatEventDateLong(deadline)}, ${responseDays} days from the date of this letter. Please respond in writing by then.`,
    ],
  });

  const documents = [
    ...new Set(
      (result.chronology?.documents ?? []).map(
        (document) => document.documentName,
      ),
    ),
  ];

  return {
    letterDate: formatEventDateLong(input.today),
    letterhead,
    recipient: [
      ...(dto.recipientName?.trim() ? [dto.recipientName.trim()] : []),
      ...(dto.recipientCompany?.trim() ? [dto.recipientCompany.trim()] : []),
      ...linesOf(dto.recipientAddress),
    ],
    re,
    salutation: `Dear ${dto.recipientName?.trim() || 'Claims Representative'}:`,
    intro,
    sections,
    closing: [
      'Thank you for your prompt attention to this claim. Please contact me with any questions.',
    ],
    signature: [
      dto.attorneyName.trim(),
      ...(dto.firmName?.trim() ? [dto.firmName.trim()] : []),
    ],
    enclosures:
      documents.length > 0 ? documents : ['Medical records and bills'],
  };
}
