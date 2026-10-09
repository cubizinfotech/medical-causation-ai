import type {
  ChronologyEvent,
  DefenseIssue,
  DefenseIssueEvidence,
  DefenseIssueKind,
  DefenseIssuesSummary,
  MedicalAnalysisRequest,
  MedicalChronology,
} from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import { EVENT_TYPE_LABELS, normalizeEventDate } from './chronology.helpers';

/**
 * "Bad facts": what the defense is likely to raise, found by fixed rules in
 * the client's own records and intake. Every issue quotes its source; no
 * medical judgment is made here and nothing is inferred beyond the text.
 */

const DAY_MS = 86_400_000;
/** Days without treatment that count as a gap. */
export const TREATMENT_GAP_DAYS = 45;
/** First treatment later than this after the accident is a delay. */
export const TREATMENT_DELAY_DAYS = 3;
/** Post-accident entries within this window describe the claimed injuries. */
const CLAIMED_WINDOW_DAYS = 60;
const MAX_GAPS = 3;
const MAX_EVIDENCE = 4;
const MAX_QUOTE_CHARS = 220;

const TREATMENT_TYPES = new Set<ChronologyEvent['type']>([
  'emergency',
  'office_visit',
  'hospital_admission',
  'imaging',
  'lab',
  'procedure',
  'surgery',
  'therapy',
]);

interface Region {
  name: string;
  words: RegExp;
  codes: RegExp;
}

/** Body areas, by words in the text or ICD-10 code prefixes. */
const REGIONS: Region[] = [
  {
    name: 'head and brain',
    words:
      /\b(head|headaches?|migraines?|concussions?|post-?concussi\w*|tbi|traumatic brain|brain|skull|cognitive|memory|dizz\w*|vertigo)\b/i,
    codes: /^(S0[0-9]|G4[34]|R51|F07)/,
  },
  {
    name: 'neck',
    words: /\b(neck|cervical\w*|whiplash|c[1-7]\s*-\s*c?[1-7])\b/i,
    codes: /^(S1[2-6]|M50|M54\.?2|M47\.?812|M48\.?02)/,
  },
  {
    name: 'mid back',
    words: /\b(thoracic|mid[- ]?back|upper back)\b/i,
    codes: /^(S2[2-4]|M54\.?6)/,
  },
  {
    name: 'low back',
    words:
      /\b(low(er)? back|lumbar|lumbosacral|sacral|sacroiliac|sciatica|l[1-5]\s*-\s*(l[1-5]|s1))\b/i,
    codes: /^(S3[2-4]|M51|M54\.?[345]|M47\.?81[67]|M48\.?06)/,
  },
  {
    name: 'shoulder',
    words: /\b(shoulders?|rotator cuff|labr(um|al)|acromio\w*|clavicles?)\b/i,
    codes: /^(S4[0-9]|M75)/,
  },
  {
    name: 'arm and elbow',
    words: /\b(elbows?|forearms?|humer(us|al))\b/i,
    codes: /^S5[0-9]/,
  },
  {
    name: 'wrist and hand',
    words: /\b(wrists?|carpal|fingers?|thumbs?)\b/i,
    codes: /^S6[0-9]/,
  },
  {
    name: 'hip and pelvis',
    words: /\b(hips?|pelvi\w*|acetabul\w*)\b/i,
    codes: /^(S7[0-9]|M16)/,
  },
  {
    name: 'knee',
    words: /\b(knees?|menisc\w*|acl|mcl|patell\w*)\b/i,
    codes: /^(S8[0-9]|M17|M23)/,
  },
  {
    name: 'ankle and foot',
    words: /\b(ankles?|foot|feet|toes?|achilles)\b/i,
    codes: /^S9[0-9]/,
  },
  {
    name: 'mental health',
    words:
      /\b(ptsd|post-?traumatic stress|anxiety|depress\w*|insomnia|panic)\b/i,
    codes: /^(F4[0-3]|F3[23])/,
  },
];

export function regionsOf(text: string, codes: string[] = []): Set<string> {
  const found = new Set<string>();
  for (const region of REGIONS) {
    if (
      region.words.test(text) ||
      codes.some((code) => region.codes.test(code.toUpperCase()))
    ) {
      found.add(region.name);
    }
  }
  return found;
}

interface TextRule {
  kind: DefenseIssueKind;
  pattern: RegExp;
  /** Matches dated before the accident are skipped (later events only). */
  afterAccidentOnly?: boolean;
}

/** Phrases in the record text that the defense looks for. */
const TEXT_RULES: TextRule[] = [
  {
    kind: 'degenerative',
    pattern:
      /\b(degenerative|degeneration|spondylosis|spondylotic|osteophytes?|osteoarthritis|arthrosis|long-?standing|pre-?existing|age-?related|old (?:fracture|injury|compression))\b/i,
  },
  {
    kind: 'pre_existing',
    pattern:
      /\b((?:prior|previous|earlier|old) (?:motor vehicle (?:accident|collision)|mva|mvc|car accident|accident|injur(?:y|ies)|fall|workers'? comp(?:ensation)?(?: claim)?)|history of (?:chronic )?(?:neck|back|low back|lumbar|cervical|shoulder|knee|hip|headaches?|migraines?)(?: pain)?)\b/i,
  },
  {
    kind: 'non_compliance',
    pattern:
      /\b(no[- ]shows?|did not (?:show|keep|attend|return|follow up|complete)|missed (?:\w+ )?appointments?|non-?compliant|non-?compliance|left against medical advice|against medical advice|stopped (?:attending )?(?:physical therapy|therapy|pt))\b/i,
  },
  {
    kind: 'intervening_event',
    pattern:
      /\b((?:subsequent|second|another|new|recent|later) (?:motor vehicle (?:accident|collision)|mva|mvc|car accident|accident|fall|injury))\b/i,
    afterAccidentOnly: true,
  },
  {
    kind: 'attorney_involvement',
    pattern:
      /\b(attorney|lawyer|law firm|letter of protection|litigation|lawsuit|personal injury claim)\b/i,
  },
];

/** Words that turn a finding into its absence ("no degenerative change"). */
const NEGATION =
  /\b(no|not|without|negative for|denies|denied|deny|free of|absence of|rule out|r\/o)\b[^.;]{0,40}$/i;

const ISSUE_TEXT: Record<
  DefenseIssueKind,
  { defenseArgument: string; response: string }
> = {
  delayed_treatment: {
    defenseArgument:
      'The defense may argue that waiting to get care shows the injury was minor or came from something else.',
    response:
      'Check for earlier care that was not uploaded (emergency room, urgent care, chiropractor, primary care) and document why care was delayed (symptoms that developed gradually, access, cost).',
  },
  treatment_gap: {
    defenseArgument:
      'The defense may argue the injury had healed during the gap, or that later treatment is for a new problem.',
    response:
      'Ask the client what happened during the gap (ongoing symptoms, home care, scheduling, cost) and check for missing records.',
  },
  pre_existing: {
    defenseArgument:
      'The defense may argue the condition existed before the accident, so the accident did not cause it.',
    response:
      'Compare the condition before and after the accident (symptoms, treatment, work limits). Aggravating a pre-existing condition can still be compensable; check the rule in your jurisdiction.',
  },
  degenerative: {
    defenseArgument:
      'The defense may argue the findings are age-related or long-standing rather than caused by the accident.',
    response:
      'Ask the treating doctor whether the accident caused or aggravated these findings, and compare with any earlier imaging.',
  },
  non_compliance: {
    defenseArgument:
      'The defense may argue the client did not follow treatment and so failed to limit the damages.',
    response:
      'Find out why appointments were missed or care stopped (transportation, work, cost, side effects) and document it.',
  },
  intervening_event: {
    defenseArgument:
      'The defense may argue a later accident or injury caused the current condition.',
    response:
      'Get the records for the later event and ask the treating doctor to separate its effects from this accident.',
  },
  attorney_involvement: {
    defenseArgument:
      'The defense may argue treatment was driven by the claim (for example attorney referral or a letter of protection).',
    response:
      'Be ready to show each treatment was medically necessary and consistent with standard care.',
  },
  reported_history: {
    defenseArgument:
      'The defense will ask about any prior condition the client already reported in the same body area.',
    response:
      'Collect the prior records and compare the condition before and after the accident.',
  },
};

const TEXT_ISSUE_TITLES: Partial<Record<DefenseIssueKind, string>> = {
  degenerative: 'Degenerative or chronic findings in the records',
  pre_existing: 'Earlier injuries or conditions mentioned in the records',
  non_compliance: 'Missed appointments or treatment not followed',
  intervening_event: 'Another accident or injury after this one',
  attorney_involvement: 'Attorney involvement mentioned in the medical records',
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export interface DefenseIssueInput {
  request: Pick<
    MedicalAnalysisRequest,
    | 'accidentDate'
    | 'injury'
    | 'diagnosis'
    | 'symptoms'
    | 'medicalHistory'
    | 'preExistingConditions'
  >;
  chronology?: MedicalChronology;
  records?: LoadedCaseRecord[];
}

export function findDefenseIssues(
  input: DefenseIssueInput,
): DefenseIssuesSummary {
  const { request, chronology } = input;
  const records = input.records ?? [];
  const events = chronology?.events ?? [];
  const notes: string[] = [];
  const issues: Array<Omit<DefenseIssue, 'id'>> = [];

  const accidentText = normalizeEventDate(request.accidentDate ?? '');
  const accident = isFullDate(accidentText) ? accidentText : null;
  if (!accident) {
    notes.push(
      'The accident date is missing or incomplete, so delays, gaps, and earlier treatment were not checked.',
    );
  }
  if (records.length === 0) {
    notes.push(
      'No medical records were uploaded, so only the intake form was checked.',
    );
  }

  const claimed = regionsOf(
    [request.injury, request.diagnosis, request.symptoms]
      .filter(Boolean)
      .join(' '),
  );
  if (accident) {
    for (const event of events) {
      if (!isFullDate(event.date) || event.date < accident) continue;
      if (daysBetween(accident, event.date) > CLAIMED_WINDOW_DAYS) continue;
      for (const region of regionsOf(eventText(event), eventCodes(event))) {
        claimed.add(region);
      }
    }
  }

  if (accident && events.length > 0) {
    issues.push(...treatmentTimingIssues(events, accident, notes));
    issues.push(...earlierTreatmentIssues(events, accident, claimed, notes));
  }
  issues.push(...recordTextIssues(records, events, accident, claimed));
  const reported = reportedHistoryIssue(request, claimed);
  if (reported) issues.push(reported);

  issues.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity],
  );
  return {
    status: accident && records.length > 0 ? 'completed' : 'limited',
    issues: issues.map((issue, index) => ({
      id: `issue-${index + 1}`,
      ...issue,
    })),
    notes,
  };
}

function treatmentTimingIssues(
  events: ChronologyEvent[],
  accident: string,
  notes: string[],
): Array<Omit<DefenseIssue, 'id'>> {
  const treatment = events
    .filter(
      (event) =>
        isFullDate(event.date) &&
        event.date >= accident &&
        TREATMENT_TYPES.has(event.type),
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  if (treatment.length === 0) {
    notes.push(
      'No dated treatment on or after the accident date was found in the uploaded records.',
    );
    return [];
  }

  const issues: Array<Omit<DefenseIssue, 'id'>> = [];
  const first = treatment[0];
  const delay = daysBetween(accident, first.date);
  if (delay > TREATMENT_DELAY_DAYS) {
    issues.push({
      kind: 'delayed_treatment',
      severity: delay > 14 ? 'high' : delay > 7 ? 'medium' : 'low',
      title: `First recorded treatment ${delay} days after the accident`,
      detail: `The accident was on ${formatDate(accident)}. The earliest treatment in the uploaded records is ${describeEvent(first)}.`,
      ...ISSUE_TEXT.delayed_treatment,
      evidence: [eventEvidence(first)],
    });
  }

  const gaps: Array<{
    before: ChronologyEvent;
    after: ChronologyEvent;
    days: number;
  }> = [];
  for (let index = 1; index < treatment.length; index++) {
    const before = treatment[index - 1];
    const after = treatment[index];
    const days = daysBetween(before.date, after.date);
    if (days > TREATMENT_GAP_DAYS) gaps.push({ before, after, days });
  }
  gaps
    .sort((left, right) => right.days - left.days)
    .slice(0, MAX_GAPS)
    .forEach((gap) =>
      issues.push({
        kind: 'treatment_gap',
        severity: gap.days > 90 ? 'high' : gap.days > 60 ? 'medium' : 'low',
        title: `Gap in treatment of ${gap.days} days`,
        detail: `No treatment is recorded between ${describeEvent(gap.before)} and ${describeEvent(gap.after)}.`,
        ...ISSUE_TEXT.treatment_gap,
        evidence: [eventEvidence(gap.before), eventEvidence(gap.after)],
      }),
    );
  return issues;
}

function earlierTreatmentIssues(
  events: ChronologyEvent[],
  accident: string,
  claimed: Set<string>,
  notes: string[],
): Array<Omit<DefenseIssue, 'id'>> {
  const before = events.filter((event) => isBefore(event.date, accident));
  const byRegion = new Map<string, ChronologyEvent[]>();
  let unrelated = 0;
  for (const event of before) {
    const overlap = [...regionsOf(eventText(event), eventCodes(event))].filter(
      (region) => claimed.has(region),
    );
    if (overlap.length === 0) unrelated += 1;
    for (const region of overlap) {
      byRegion.set(region, [...(byRegion.get(region) ?? []), event]);
    }
  }
  if (unrelated > 0) {
    notes.push(
      unrelated === 1
        ? '1 record entry dated before the accident involves other body areas.'
        : `${unrelated} record entries dated before the accident involve other body areas.`,
    );
  }
  const twoYearsBefore = shiftYears(accident, -2);
  return [...byRegion.entries()].map(([region, list]) => {
    const recent = list.some((event) => !isBefore(event.date, twoYearsBefore));
    return {
      kind: 'pre_existing' as const,
      severity: recent ? ('high' as const) : ('medium' as const),
      title: `Treatment of the ${region} before the accident`,
      detail: `${list.length} record entr${list.length === 1 ? 'y' : 'ies'} dated before the accident (${formatDate(accident)}) involve the ${region}: ${list
        .slice(0, MAX_EVIDENCE)
        .map(describeEvent)
        .join('; ')}.`,
      ...ISSUE_TEXT.pre_existing,
      evidence: list.slice(0, MAX_EVIDENCE).map(eventEvidence),
    };
  });
}

function recordTextIssues(
  records: LoadedCaseRecord[],
  events: ChronologyEvent[],
  accident: string | null,
  claimed: Set<string>,
): Array<Omit<DefenseIssue, 'id'>> {
  const pageDates = new Map<string, string[]>();
  for (const event of events) {
    const key = `${event.recordId}:${event.pageNumber}`;
    if (event.date)
      pageDates.set(key, [...(pageDates.get(key) ?? []), event.date]);
  }

  const found = new Map<DefenseIssueKind, DefenseIssueEvidence[]>();
  const relevant = new Set<DefenseIssueKind>();
  for (const record of records) {
    for (const page of record.pages) {
      const dates = pageDates.get(`${record.id}:${page.pageNumber}`) ?? [];
      for (const rule of TEXT_RULES) {
        if (
          rule.afterAccidentOnly &&
          accident &&
          dates.length > 0 &&
          dates.every((date) => isBefore(date, accident))
        ) {
          continue;
        }
        const quote = findQuote(page.text, rule.pattern);
        if (!quote) continue;
        const list = found.get(rule.kind) ?? [];
        list.push({
          source: 'record',
          recordId: record.id,
          documentName: record.name,
          pageNumber: page.pageNumber,
          ...(dates[0] ? { date: dates[0] } : {}),
          quote,
        });
        found.set(rule.kind, list);
        if ([...regionsOf(quote)].some((region) => claimed.has(region))) {
          relevant.add(rule.kind);
        }
      }
    }
  }

  return [...found.entries()].map(([kind, evidence]) => {
    const severity =
      kind === 'attorney_involvement'
        ? ('low' as const)
        : relevant.has(kind) || kind === 'intervening_event'
          ? ('high' as const)
          : ('medium' as const);
    return {
      kind,
      severity,
      title: TEXT_ISSUE_TITLES[kind] ?? 'Issue found in the records',
      detail: `Found on ${evidence.length} page${evidence.length === 1 ? '' : 's'} of the uploaded records${evidence.length > MAX_EVIDENCE ? `; the first ${MAX_EVIDENCE} are shown` : ''}.`,
      ...ISSUE_TEXT[kind],
      evidence: evidence.slice(0, MAX_EVIDENCE),
    };
  });
}

function reportedHistoryIssue(
  request: DefenseIssueInput['request'],
  claimed: Set<string>,
): Omit<DefenseIssue, 'id'> | null {
  const history =
    request.medicalHistory
      ?.match(
        /Prior History:\s*([\s\S]*?)(?:\n(?:Medications|Timeline):|$)/,
      )?.[1]
      ?.trim() ||
    request.preExistingConditions?.trim() ||
    '';
  if (!history || /^(none|n\/?a|no|nil|denies|unremarkable)\b/i.test(history)) {
    return null;
  }
  const overlap = [...regionsOf(history)].filter((region) =>
    claimed.has(region),
  );
  return {
    kind: 'reported_history',
    severity: overlap.length > 0 ? 'medium' : 'low',
    title:
      overlap.length > 0
        ? `Prior history reported for the ${overlap.join(' and ')}`
        : 'Prior medical history reported on the intake form',
    detail: 'The intake form lists prior medical history.',
    ...ISSUE_TEXT.reported_history,
    evidence: [{ source: 'intake', quote: truncate(history, MAX_QUOTE_CHARS) }],
  };
}

/**
 * The sentence around the first match that is not negated, copied exactly
 * from the page. Long sentences are cut to a window around the match.
 */
export function findQuote(text: string, pattern: RegExp): string | null {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  for (const match of text.matchAll(global)) {
    const index = match.index ?? 0;
    if (NEGATION.test(text.slice(Math.max(0, index - 60), index))) continue;
    const start = sentenceStart(text, index);
    const end = sentenceEnd(text, index + match[0].length);
    let quote = text.slice(start, end).trim();
    if (quote.length > MAX_QUOTE_CHARS) {
      const from = Math.max(start, index - 100);
      const to = Math.min(end, index + match[0].length + 100);
      quote = trimToWords(text, from, to);
    }
    return quote;
  }
  return null;
}

function sentenceStart(text: string, index: number): number {
  const before = text.slice(0, index);
  const stop = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('? '),
    before.lastIndexOf('! '),
    before.lastIndexOf('; '),
  );
  return stop === -1 ? 0 : stop + 2;
}

function sentenceEnd(text: string, index: number): number {
  const match = /[.?!;](\s|$)/.exec(text.slice(index));
  return match ? index + match.index + 1 : text.length;
}

function trimToWords(text: string, start: number, end: number): string {
  let from = start;
  let to = end;
  if (from > 0) {
    const space = text.indexOf(' ', from);
    if (space !== -1 && space < to) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > from) to = space;
  }
  return text.slice(from, to).trim();
}

function eventEvidence(event: ChronologyEvent): DefenseIssueEvidence {
  return {
    source: 'record',
    chronologyId: event.id,
    recordId: event.recordId,
    documentName: event.documentName,
    pageNumber: event.pageNumber,
    ...(event.date ? { date: event.date } : {}),
    quote: event.quote || event.summary,
  };
}

function eventText(event: ChronologyEvent): string {
  return [
    event.summary,
    ...event.diagnoses.map((diagnosis) => diagnosis.description),
    ...event.treatments,
  ].join(' ');
}

function eventCodes(event: ChronologyEvent): string[] {
  return event.diagnoses
    .map((diagnosis) => diagnosis.icd10)
    .filter((code): code is string => Boolean(code));
}

function describeEvent(event: ChronologyEvent): string {
  const where = event.facility || event.provider;
  return `${EVENT_TYPE_LABELS[event.type].toLowerCase()} on ${formatDate(event.date)}${where ? ` (${where})` : ''}`;
}

function isFullDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** True only when the date is certainly earlier (partial dates compare by period). */
function isBefore(date: string, reference: string): boolean {
  if (!date) return false;
  if (isFullDate(date)) return date < reference;
  if (/^\d{4}-\d{2}$/.test(date)) return date < reference.slice(0, 7);
  if (/^\d{4}$/.test(date)) return date < reference.slice(0, 4);
  return false;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

function shiftYears(date: string, years: number): string {
  return `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
}

function formatDate(date: string): string {
  if (!isFullDate(date)) return date || 'an undated entry';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
