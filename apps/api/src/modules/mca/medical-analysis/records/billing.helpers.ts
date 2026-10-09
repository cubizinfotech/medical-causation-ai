import type {
  BillingCharge,
  BillingPrintedTotal,
  BillingTotalKind,
  ChronologyEvent,
  MedicalSpecials,
  ProviderBilling,
  UnbilledProvider,
} from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import {
  buildChronologyBatches,
  locateQuote,
  normalizeEventDate,
  type ChronologyBatch,
} from './chronology.helpers';

/** Characters of bill text per AI call: about one dense page, so the reply fits. */
export const BILLING_BATCH_CHARS = 5000;

const DOLLAR_AMOUNT = /\$\s?\d{1,3}(?:,?\d{3})*(?:\.\d{2})?/g;
const CENTS_AMOUNT = /(?<![\d.,])\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)/g;
const BILLING_WORDS =
  /\b(?:total charges?|charges?|amount due|balance(?: due)?|itemi[sz]ed|statement|account (?:no|number|#)|cpt|hcpcs|rev(?:enue)? code|ub-?04|cms-?1500|hcfa|payments?|paid|adjustments?|write-?offs?|date of service|dos|billed|fees?|patient responsibility)\b/gi;

/** A page that looks like a bill, statement, or ledger. */
export function isBillPage(text: string): boolean {
  const dollars = text.match(DOLLAR_AMOUNT)?.length ?? 0;
  const amounts = text.match(CENTS_AMOUNT)?.length ?? 0;
  const found: string[] = text.match(BILLING_WORDS) ?? [];
  const words = new Set(
    found.map((word) =>
      word
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/s$/, ''),
    ),
  ).size;
  return (dollars >= 2 && words >= 2) || (amounts >= 4 && words >= 3);
}

/** The bill pages of each record; a batch never spans two records. */
export function buildBillingBatches(
  records: LoadedCaseRecord[],
  maxChars: number,
): ChronologyBatch[] {
  return buildChronologyBatches(
    records.map((record) => ({
      ...record,
      pages: record.pages.filter((page) => isBillPage(page.text)),
    })),
    maxChars,
  );
}

export interface RawBilling {
  charges: unknown[];
  totals: unknown[];
  /** The reply was cut off; only its complete entries were read. */
  truncated: boolean;
}

/** Complete {...} objects one level inside the reply (string-aware). */
function completeObjects(text: string): Array<Record<string, unknown>> {
  const objects: Array<Record<string, unknown>> = [];
  let depth = 0;
  let begin = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) begin = i;
      depth += 1;
    } else if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        try {
          objects.push(
            JSON.parse(text.slice(begin, i + 1)) as Record<string, unknown>,
          );
        } catch {
          // An entry that is not valid JSON is skipped.
        }
      }
    }
  }
  return objects;
}

/**
 * Reads {"charges": [...], "totals": [...]}. A reply cut off by the output
 * limit keeps its complete entries and is marked truncated.
 */
export function parseBillingResponse(content: string): RawBilling {
  const start = content.indexOf('{');
  if (start < 0) throw new Error('No JSON in billing response');
  const end = content.lastIndexOf('}');
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    return {
      charges: Array.isArray(parsed.charges) ? parsed.charges : [],
      totals: Array.isArray(parsed.totals) ? parsed.totals : [],
      truncated: false,
    };
  } catch {
    const entries = completeObjects(content.slice(start + 1));
    if (entries.length === 0) throw new Error('Unreadable billing response');
    return {
      charges: entries.filter((entry) => !('kind' in entry)),
      totals: entries.filter((entry) => 'kind' in entry),
      truncated: true,
    };
  }
}

/** "$1,250.00", "1250", "(85.00)" -> cents and the printed text. */
export function parseAmount(
  value: unknown,
): { cents: number; text: string } | null {
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(2)
      : value;
  if (typeof raw !== 'string') return null;
  const text = raw
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .replace(/^-\s*/, '')
    .replace(/^\$\s*/, '')
    .replace(/\s*(?:CR|DR)$/i, '')
    .trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text.replace(/,/g, '')) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 1_000_000_000) {
    return null;
  }
  return { cents, text };
}

/** Characters OCR commonly misreads in printed amounts. */
function foldOcrDigits(text: string): string {
  return text.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5');
}

/** The amount is printed on the page: "1,250.00", "1250.00", or "$1,250". */
export function amountPrintedOn(
  cents: number,
  pageText: string,
  options: { ocr?: boolean } = {},
): boolean {
  const fraction = String(cents % 100).padStart(2, '0');
  const whole = Math.floor(cents / 100)
    .toLocaleString('en-US')
    .replace(/,/g, ',?');
  const patterns = [new RegExp(`(?<![\\d.,])${whole}\\.${fraction}(?!\\d)`)];
  if (fraction === '00') {
    patterns.push(new RegExp(`\\$\\s?${whole}(?![\\d]|[.,]\\d)`));
  }
  const texts = options.ocr ? [pageText, foldOcrDigits(pageText)] : [pageText];
  return texts.some((text) => patterns.some((pattern) => pattern.test(text)));
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const pad2 = (value: string | number) => String(value).padStart(2, '0');

function fullYear(text: string, now: Date): number {
  if (text.length === 4) return Number(text);
  const short = Number(text);
  return short <= (now.getFullYear() + 1) % 100 ? 2000 + short : 1900 + short;
}

/** Every full date printed on the page, as YYYY-MM-DD. */
export function datesPrintedOn(text: string, now = new Date()): Set<string> {
  const dates = new Set<string>();
  const add = (year: number, month: number, day: number) => {
    const iso = normalizeEventDate(`${year}-${pad2(month)}-${pad2(day)}`, now);
    if (iso) dates.add(iso);
  };
  for (const match of text.matchAll(
    /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g,
  )) {
    add(fullYear(match[3], now), Number(match[1]), Number(match[2]));
  }
  for (const match of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    add(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  for (const match of text.matchAll(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  )) {
    add(
      Number(match[3]),
      MONTHS.indexOf(match[1].toLowerCase()) + 1,
      Number(match[2]),
    );
  }
  return dates;
}

/** The model's date of service, kept only when that date is printed. */
function verifiedServiceDate(
  value: unknown,
  printed: Set<string>,
  now: Date,
): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  let iso = normalizeEventDate(raw, now);
  const short = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(raw);
  if (!iso && short) {
    iso = normalizeEventDate(
      `${fullYear(short[3], now)}-${pad2(short[1])}-${pad2(short[2])}`,
      now,
    );
  }
  return iso.length === 10 && printed.has(iso) ? iso : '';
}

/** CPT (99285, 0001F), HCPCS (J1885), or revenue code (0450), if printed. */
function verifiedCode(value: unknown, pageText: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[-\s].*$/, '');
  if (!/^(?:\d{5}|\d{4}[FTU]|[A-V]\d{4}|0?\d{3})$/.test(code)) return undefined;
  return new RegExp(`(?<![A-Z0-9])${code}(?![A-Z0-9])`, 'i').test(pageText)
    ? code
    : undefined;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

const TOTAL_KINDS: readonly BillingTotalKind[] = [
  'total_charges',
  'payments',
  'adjustments',
  'balance',
];

/** A charge before duplicates are found and citation ids are assigned. */
export type DraftCharge = Omit<BillingCharge, 'id' | 'duplicateOf'>;

export interface DraftBilling {
  charges: DraftCharge[];
  totals: BillingPrintedTotal[];
  /** Entries left out because the amount is not printed on the cited page. */
  dropped: number;
}

/**
 * Turns the model's entries into trusted drafts. Every amount must be printed
 * on the cited page; dates and codes that are not printed are left blank.
 */
export function validateBilling(
  raw: Pick<RawBilling, 'charges' | 'totals'>,
  batch: ChronologyBatch,
  now = new Date(),
): DraftBilling {
  const pages = new Map(batch.pages.map((page) => [page.pageNumber, page]));
  const result: DraftBilling = { charges: [], totals: [], dropped: 0 };

  const place = (item: Record<string, unknown>) => {
    const claimed = Number(item.page);
    const quote = cleanText(item.quote, 300);
    const quotePage = quote ? locateQuote(quote, batch, claimed) : null;
    const pageNumber = quotePage ?? (pages.has(claimed) ? claimed : null);
    const amount = parseAmount(item.amount);
    if (pageNumber === null || !amount) return null;
    const page = pages.get(pageNumber)!;
    const ocr = page.ocrConfidence != null;
    if (!amountPrintedOn(amount.cents, page.text, { ocr })) return null;
    return { page, ocr, quote, quoteVerified: quotePage !== null, amount };
  };

  for (const entry of raw.charges) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const placed = place(item);
    if (!placed) {
      result.dropped += 1;
      continue;
    }
    const { page, amount } = placed;
    const code = verifiedCode(item.code, page.text);
    result.charges.push({
      provider: cleanText(item.provider, 120),
      dateOfService: verifiedServiceDate(
        item.dateOfService,
        datesPrintedOn(page.text, now),
        now,
      ),
      description:
        cleanText(item.description, 200) || (code ? `Code ${code}` : 'Charge'),
      ...(code ? { code } : {}),
      amount: amount.cents / 100,
      amountText: amount.text,
      recordId: batch.recordId,
      documentName: batch.documentName,
      pageNumber: page.pageNumber,
      batesNumbers: page.batesNumbers,
      quote: placed.quote,
      quoteVerified: placed.quoteVerified,
      ...(placed.ocr ? { ocrConfidence: page.ocrConfidence! } : {}),
    });
  }

  for (const entry of raw.totals) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const kind = item.kind as BillingTotalKind;
    const placed = TOTAL_KINDS.includes(kind) ? place(item) : null;
    if (!placed) {
      result.dropped += 1;
      continue;
    }
    result.totals.push({
      provider: cleanText(item.provider, 120),
      kind,
      amount: placed.amount.cents / 100,
      amountText: placed.amount.text,
      recordId: batch.recordId,
      documentName: batch.documentName,
      pageNumber: placed.page.pageNumber,
      quote: placed.quote,
    });
  }
  return result;
}

const CORPORATE_SUFFIX =
  /\b(?:inc|llc|pllc|llp|ltd|pc|pa|plc|corp|co|lp|sc|dba)\b/g;

/** Comparable form of a provider name: "St. Mary's Hospital, Inc." -> "st mary hospital". */
export function providerKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(CORPORATE_SUFFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words that do not tell two providers apart. */
const GENERIC_NAME_WORDS = new Set(
  (
    'the and for dr md do mbbs dds dc pt np rn pac ' +
    'group associates assoc medical medicine center centre centers hospital ' +
    'hospitals clinic clinics health healthcare care services service ' +
    'department dept physicians physician practice partners specialists ' +
    'specialty urgent emergency system network institute university ' +
    'regional community general family saint mount imaging radiology ' +
    'therapy physical rehab rehabilitation orthopedic orthopaedic ' +
    'orthopedics orthopaedics neurology spine pain management chiropractic ' +
    'diagnostic diagnostics laboratory lab labs pharmacy ambulance ems ' +
    'surgery surgical billing office east west north south'
  ).split(' '),
);

function distinctiveWords(name: string): string[] {
  return providerKey(name)
    .split(' ')
    .filter((word) => word.length >= 3 && !GENERIC_NAME_WORDS.has(word));
}

/** Two provider names share a distinctive word ("Reyes Neurology" ~ "Dr. Alan Reyes"). */
export function sameProvider(a: string, b: string): boolean {
  const words = new Set(distinctiveWords(a));
  return distinctiveWords(b).some((word) => words.has(word));
}

const TOTAL_LINE =
  /\b(?:total|balance|payments?|paid|adjust|write.?off|amount due)/i;

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const toCents = (dollars: number) => Math.round(dollars * 100);

/** Event types that come with a bill. */
const BILLABLE_EVENT_TYPES = new Set<ChronologyEvent['type']>([
  'emergency',
  'office_visit',
  'hospital_admission',
  'imaging',
  'lab',
  'procedure',
  'surgery',
  'therapy',
]);

export interface FinalizeSpecialsInput {
  drafts: DraftBilling[];
  records: Array<Pick<LoadedCaseRecord, 'id' | 'name'>>;
  billPages: MedicalSpecials['billPages'];
  events?: ChronologyEvent[];
  /** Warnings from reading (failed or cut-off batches). */
  warnings?: string[];
  failedBatches?: number;
  totalBatches?: number;
  truncated?: boolean;
  generatedAt?: string;
}

/**
 * The ledger: fixed rules over the verified lines. Charges printed on two
 * pages are counted once; totals are the sum of the lines, compared with the
 * total printed on the bill.
 */
export function finalizeSpecials(
  input: FinalizeSpecialsInput,
): MedicalSpecials {
  const warnings = [...(input.warnings ?? [])];
  const recordOrder = input.records.map((record) => record.id);
  const pageKey = (item: { recordId: string; pageNumber: number }) =>
    `${item.recordId}:${item.pageNumber}`;

  const allCharges = input.drafts.flatMap((draft) => draft.charges);
  const allTotals = input.drafts.flatMap((draft) => draft.totals);
  const dropped = input.drafts.reduce((sum, draft) => sum + draft.dropped, 0);

  // A line without a provider takes the provider named on its page, then
  // in its document.
  const namedOnPage = new Map<string, string[]>();
  const namedInRecord = new Map<string, string[]>();
  for (const item of [...allCharges, ...allTotals]) {
    if (!item.provider) continue;
    namedOnPage.set(pageKey(item), [
      ...(namedOnPage.get(pageKey(item)) ?? []),
      item.provider,
    ]);
    namedInRecord.set(item.recordId, [
      ...(namedInRecord.get(item.recordId) ?? []),
      item.provider,
    ]);
  }
  const providerOf = (item: {
    provider: string;
    recordId: string;
    pageNumber: number;
    documentName: string;
  }) =>
    item.provider ||
    mostCommon(namedOnPage.get(pageKey(item)) ?? []) ||
    mostCommon(namedInRecord.get(item.recordId) ?? []) ||
    `Provider not named (${item.documentName})`;

  // One display spelling per provider: the most common one.
  const spellings = new Map<string, string[]>();
  const keyed = <T extends { provider: string }>(item: T) => {
    const key = providerKey(item.provider) || item.provider;
    spellings.set(key, [...(spellings.get(key) ?? []), item.provider]);
    return key;
  };
  const charges = allCharges.map((charge) => ({
    ...charge,
    provider: providerOf(charge),
  }));
  const totals = allTotals.map((total) => ({
    ...total,
    provider: providerOf(total),
  }));
  const chargeKeys = charges.map(keyed);
  const totalKeys = totals.map(keyed);
  const display = (key: string) => mostCommon(spellings.get(key) ?? []) ?? key;

  // A "charge" that is really a printed total on its page is left out.
  const totalsOnPage = new Map<string, Set<number>>();
  for (const total of totals) {
    const set = totalsOnPage.get(pageKey(total)) ?? new Set<number>();
    set.add(toCents(total.amount));
    totalsOnPage.set(pageKey(total), set);
  }
  const kept = charges
    .map((charge, index) => ({ charge, key: chargeKeys[index], index }))
    .filter(
      ({ charge }) =>
        !(
          TOTAL_LINE.test(charge.description) &&
          totalsOnPage.get(pageKey(charge))?.has(toCents(charge.amount))
        ),
    );
  const removedTotals = charges.length - kept.length;

  const position = (charge: DraftCharge) =>
    recordOrder.indexOf(charge.recordId) * 100000 + charge.pageNumber;
  kept.sort((a, b) => {
    const [x, y] = [a.charge.dateOfService, b.charge.dateOfService];
    if (x && y && x !== y) return x < y ? -1 : 1;
    if (x && !y) return -1;
    if (!x && y) return 1;
    return position(a.charge) - position(b.charge) || a.index - b.index;
  });

  // The same line printed on another page (a bill included twice) counts once.
  const firstSeen = new Map<string, { id: string; page: string }>();
  const finalCharges: BillingCharge[] = kept.map(({ charge, key }, index) => {
    const id = `chg-${index + 1}`;
    const lineKey = [
      key,
      charge.dateOfService,
      charge.code ?? '',
      toCents(charge.amount),
      providerKey(charge.description).slice(0, 30),
    ].join('|');
    const first = firstSeen.get(lineKey);
    if (!first) firstSeen.set(lineKey, { id, page: pageKey(charge) });
    const duplicateOf =
      first && first.page !== pageKey(charge) ? first.id : undefined;
    return {
      id,
      ...charge,
      provider: display(key),
      ...(duplicateOf ? { duplicateOf } : {}),
    };
  });

  const keyOfCharge = new Map(
    kept.map(({ key }, index) => [finalCharges[index].id, key]),
  );
  const providerKeys = [...new Set([...kept.map((k) => k.key), ...totalKeys])];
  const providers: ProviderBilling[] = providerKeys.map((key) => {
    const lines = finalCharges.filter(
      (charge) => keyOfCharge.get(charge.id) === key && !charge.duplicateOf,
    );
    const printed: BillingPrintedTotal[] = [];
    const seenPrinted = new Set<string>();
    totals.forEach((total, index) => {
      if (totalKeys[index] !== key) return;
      const signature = `${total.kind}|${toCents(total.amount)}`;
      if (seenPrinted.has(signature)) return;
      seenPrinted.add(signature);
      printed.push({ ...total, provider: display(key) });
    });
    const printedCharges = printed.filter(
      (total) => total.kind === 'total_charges',
    );
    const lineCents = lines.reduce(
      (sum, charge) => sum + toCents(charge.amount),
      0,
    );
    const largestPrinted = printedCharges.reduce<BillingPrintedTotal | null>(
      (best, total) => (!best || total.amount > best.amount ? total : best),
      null,
    );
    const dates = lines
      .map((charge) => charge.dateOfService)
      .filter(Boolean)
      .sort();
    const billing: ProviderBilling = {
      provider: display(key),
      firstDate: dates[0] ?? '',
      lastDate: dates[dates.length - 1] ?? '',
      billed:
        lines.length > 0 ? lineCents / 100 : (largestPrinted?.amount ?? 0),
      billedFrom:
        lines.length === 0 && largestPrinted ? 'printed_total' : 'charges',
      chargeCount: lines.length,
      printedTotals: printed,
    };
    if (
      lines.length > 0 &&
      printedCharges.length === 1 &&
      Math.abs(toCents(printedCharges[0].amount) - lineCents) > 1
    ) {
      billing.mismatch = {
        printed: printedCharges[0].amount,
        read: lineCents / 100,
        documentName: printedCharges[0].documentName,
        pageNumber: printedCharges[0].pageNumber,
      };
      warnings.push(
        `${billing.provider}: the charges read add up to ${usd(lineCents)}, but ${printedCharges[0].documentName} p. ${printedCharges[0].pageNumber} prints total charges of ${usd(toCents(printedCharges[0].amount))}. Check the bill for lines that were missed.`,
      );
    }
    if (lines.length === 0 && printedCharges.length > 1) {
      warnings.push(
        `${billing.provider}: several different total charges are printed; the largest (${usd(toCents(largestPrinted!.amount))}, ${largestPrinted!.documentName} p. ${largestPrinted!.pageNumber}) is used. Check the bills.`,
      );
    }
    if (lines.length === 0 && !largestPrinted) {
      warnings.push(
        `${billing.provider}: only payments or a balance are printed; no charges were read.`,
      );
    }
    return billing;
  });
  providers.sort((a, b) => {
    if (a.firstDate && b.firstDate && a.firstDate !== b.firstDate) {
      return a.firstDate < b.firstDate ? -1 : 1;
    }
    if (a.firstDate && !b.firstDate) return -1;
    if (!a.firstDate && b.firstDate) return 1;
    return a.provider.localeCompare(b.provider);
  });

  const unbilledProviders = findUnbilledProviders(
    input.events ?? [],
    providers.map((provider) => provider.provider),
  );

  const duplicates = finalCharges.filter((charge) => charge.duplicateOf).length;
  if (duplicates > 0) {
    warnings.push(
      `${duplicates} charge(s) appear on more than one page and were counted once.`,
    );
  }
  if (dropped > 0) {
    warnings.push(
      `${dropped} line(s) the AI listed were left out because the amount is not printed on the cited page.`,
    );
  }
  if (removedTotals > 0) {
    warnings.push(
      `${removedTotals} line(s) were totals or payments, not charges, and were left out.`,
    );
  }
  const unverified = finalCharges.filter((charge) => !charge.quoteVerified);
  if (unverified.length > 0) {
    warnings.push(
      `${unverified.length} charge(s) could not be matched to the exact text of the cited line; their amounts are printed on the page. Check those lines.`,
    );
  }
  const scanned = finalCharges.filter((charge) => charge.ocrConfidence != null);
  if (scanned.length > 0) {
    warnings.push(
      `${scanned.length} charge(s) were read from scanned pages with OCR. Check their amounts against the original bill.`,
    );
  }

  const totalBatches = input.totalBatches ?? 0;
  const failed = input.failedBatches ?? 0;
  return {
    status:
      input.billPages.length === 0
        ? 'no_bills'
        : totalBatches > 0 && failed === totalBatches
          ? 'failed'
          : failed > 0 || input.truncated
            ? 'partial'
            : 'completed',
    charges: finalCharges,
    providers,
    totalBilled:
      providers.reduce((sum, provider) => sum + toCents(provider.billed), 0) /
      100,
    billPages: input.billPages,
    unbilledProviders,
    warnings,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * Treating providers in the chronology whose name matches no bill: the bills
 * to request. Matched by distinctive words in the names, so check the list.
 */
export function findUnbilledProviders(
  events: ChronologyEvent[],
  billedProviders: string[],
): UnbilledProvider[] {
  const groups = new Map<string, UnbilledProvider>();
  for (const event of events) {
    if (!BILLABLE_EVENT_TYPES.has(event.type)) continue;
    const names = [event.facility, event.provider].filter(
      (name): name is string => Boolean(name),
    );
    if (names.length === 0) continue;
    const billed = names.some((name) =>
      billedProviders.some((provider) => sameProvider(name, provider)),
    );
    if (billed) continue;
    const name = names[0];
    const key = providerKey(name) || name;
    const group = groups.get(key) ?? {
      provider: name,
      firstDate: '',
      lastDate: '',
      visits: 0,
      chronologyIds: [],
    };
    group.visits += 1;
    group.chronologyIds.push(event.id);
    if (event.date) {
      if (!group.firstDate || event.date < group.firstDate) {
        group.firstDate = event.date;
      }
      if (!group.lastDate || event.date > group.lastDate) {
        group.lastDate = event.date;
      }
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.firstDate || '9999').localeCompare(b.firstDate || '9999'),
  );
}

/** Bill pages per record, for the report. */
export function billPagesOf(
  batches: ChronologyBatch[],
): MedicalSpecials['billPages'] {
  const byRecord = new Map<
    string,
    { recordId: string; documentName: string; pages: number[] }
  >();
  for (const batch of batches) {
    const entry = byRecord.get(batch.recordId) ?? {
      recordId: batch.recordId,
      documentName: batch.documentName,
      pages: [],
    };
    entry.pages.push(...batch.pages.map((page) => page.pageNumber));
    byRecord.set(batch.recordId, entry);
  }
  return [...byRecord.values()];
}
