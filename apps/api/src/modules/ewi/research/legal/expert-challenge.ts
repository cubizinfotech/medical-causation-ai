import type { ExpertEvidenceItem } from '@integrations/expert-research';

/**
 * Admissibility challenges (Daubert, Frye, Rule 702, motions to exclude).
 * An outcome is recorded only when the court's own words, quoted exactly
 * from the collected opinion text, state it.
 */

export const CHALLENGE_STANDARDS = [
  'daubert',
  'frye',
  'rule_702',
  'unspecified',
] as const;
export type ChallengeStandard = (typeof CHALLENGE_STANDARDS)[number];

export const CHALLENGE_OUTCOMES = [
  'excluded',
  'limited',
  'admitted',
  'not_challenged',
  'not_determined',
] as const;
export type ChallengeOutcome = (typeof CHALLENGE_OUTCOMES)[number];

export const CHALLENGE_ROLES = [
  'challenged_expert',
  'other',
  'unclear',
] as const;
export type ChallengeRole = (typeof CHALLENGE_ROLES)[number];

export interface ExpertChallenge {
  standard: ChallengeStandard;
  outcome: ChallengeOutcome;
  /** challenged_expert: the ruling was about this expert's testimony. */
  role: ChallengeRole;
  /** Exact words from the opinion that state the outcome. */
  quote: string | null;
  basis: 'court_text' | 'not_determined';
  excerpts: string[];
  excerptSource: 'opinion_text' | 'search_snippet' | null;
  note: string;
}

export const CHALLENGE_OUTCOME_LABEL: Record<ChallengeOutcome, string> = {
  excluded: 'Excluded',
  limited: 'Limited',
  admitted: 'Admitted',
  not_challenged: 'Not about this expert',
  not_determined: 'Not determined',
};

export const CHALLENGE_STANDARD_LABEL: Record<ChallengeStandard, string> = {
  daubert: 'Daubert',
  frye: 'Frye',
  rule_702: 'Rule 702',
  unspecified: 'Admissibility challenge',
};

export function readExpertChallenge(value: unknown): ExpertChallenge | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const standard = oneOf(raw.standard, CHALLENGE_STANDARDS, 'unspecified');
  const outcome = oneOf(raw.outcome, CHALLENGE_OUTCOMES, 'not_determined');
  const quote =
    typeof raw.quote === 'string' && raw.quote.trim() ? raw.quote.trim() : null;
  const determined = outcome !== 'not_determined' && quote !== null;
  const excerpts = Array.isArray(raw.excerpts)
    ? raw.excerpts.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : [];
  const excerptSource =
    raw.excerptSource === 'opinion_text' ||
    raw.excerptSource === 'search_snippet'
      ? raw.excerptSource
      : null;
  const challenge: ExpertChallenge = {
    standard,
    outcome: determined ? outcome : 'not_determined',
    role: determined ? oneOf(raw.role, CHALLENGE_ROLES, 'unclear') : 'unclear',
    quote: determined ? quote : null,
    basis: determined ? 'court_text' : 'not_determined',
    excerpts,
    excerptSource,
    note: '',
  };
  challenge.note = challengeNote(challenge);
  return challenge;
}

export function challengeNote(challenge: ExpertChallenge): string {
  if (challenge.basis === 'court_text' && challenge.quote) {
    if (challenge.outcome === 'not_challenged') {
      return `The challenge in this opinion concerned another witness. The court’s words: “${challenge.quote}”`;
    }
    return `${CHALLENGE_OUTCOME_LABEL[challenge.outcome]} — the court’s words: “${challenge.quote}”`;
  }
  return challenge.excerptSource === 'search_snippet'
    ? 'Outcome not determined. Only a short search excerpt was available; read the opinion.'
    : 'Outcome not determined from the collected text. Read the opinion.';
}

/** One model reading of an opinion excerpt, before validation. */
export interface ChallengeReading {
  id: string;
  role: string;
  outcome: string;
  quote: string | null;
}

const RULING_WORDS: Record<
  Exclude<ChallengeOutcome, 'not_determined' | 'not_challenged'>,
  RegExp
> = {
  excluded: /exclu|strik|stricken|preclud|barred|inadmissible|granted|sustain/i,
  limited: /limit|in part|partial|restrict|narrow|confine/i,
  admitted:
    /den(?:y|ied|ies)|admissible|admit|permit|allow|overrul|may testify|will be allowed/i,
};

function normalizeText(value: string): string {
  return value
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Accepts a reading only when its quote appears in the excerpts word for
 * word, names the expert, and uses ruling words that fit the outcome.
 * Anything else stays "not determined".
 */
export function validateChallengeReading(
  reading: ChallengeReading,
  excerpts: string[],
  surname: string,
): Pick<ExpertChallenge, 'outcome' | 'role' | 'quote'> {
  const undetermined = {
    outcome: 'not_determined' as const,
    role: 'unclear' as const,
    quote: null,
  };
  const outcome = oneOf(reading.outcome, CHALLENGE_OUTCOMES, 'not_determined');
  const role = oneOf(reading.role, CHALLENGE_ROLES, 'unclear');
  const quote = reading.quote?.trim() ?? '';
  if (outcome === 'not_determined' || !quote || quote.length > 400) {
    return undetermined;
  }
  const normalizedQuote = normalizeText(quote);
  if (
    !excerpts.some((excerpt) =>
      normalizeText(excerpt).includes(normalizedQuote),
    )
  ) {
    return undetermined;
  }
  if (!normalizedQuote.includes(surname.toLowerCase())) return undetermined;
  if (outcome === 'not_challenged') {
    return role === 'other' ? { outcome, role, quote } : undetermined;
  }
  if (role !== 'challenged_expert') return undetermined;
  if (!RULING_WORDS[outcome].test(quote)) return undetermined;
  return { outcome, role, quote };
}

export interface ChallengeCandidate {
  /** Index of the evidence item. */
  index: number;
  id: string;
  caseName: string;
  court: string | null;
  date: string | null;
  excerpts: string[];
}

/** Evidence items with an undetermined challenge and text to read. */
export function challengeCandidates(
  evidence: ExpertEvidenceItem[],
  limit: number,
): ChallengeCandidate[] {
  const found: ChallengeCandidate[] = [];
  evidence.forEach((item, index) => {
    if (found.length >= limit) return;
    if (item.identityMatch === 'uncertain') return;
    const challenge = readExpertChallenge(item.raw?.challenge);
    if (!challenge || challenge.basis === 'court_text') return;
    if (challenge.excerpts.length === 0) return;
    found.push({
      index,
      id: `c${found.length + 1}`,
      caseName: stringOf(item.raw?.caseName) ?? item.title,
      court: stringOf(item.raw?.court),
      date: stringOf(item.raw?.documentDate),
      excerpts: challenge.excerpts,
    });
  });
  return found;
}

/**
 * Writes validated readings back into the evidence so the result survives
 * checkpoints and is rebuilt the same way from stored findings.
 */
export function applyChallengeReadings(
  evidence: ExpertEvidenceItem[],
  candidates: ChallengeCandidate[],
  readings: ChallengeReading[],
  surname: string,
): { evidence: ExpertEvidenceItem[]; determined: number } {
  const byId = new Map(readings.map((reading) => [reading.id, reading]));
  const next = evidence.slice();
  let determined = 0;
  for (const candidate of candidates) {
    const reading = byId.get(candidate.id);
    if (!reading) continue;
    const verdict = validateChallengeReading(
      reading,
      candidate.excerpts,
      surname,
    );
    if (verdict.outcome === 'not_determined') continue;
    const item = next[candidate.index];
    const raw = item.raw ?? {};
    const current = readExpertChallenge(raw.challenge);
    if (!current) continue;
    const updated: ExpertChallenge = {
      ...current,
      ...verdict,
      basis: 'court_text',
      note: '',
    };
    updated.note = challengeNote(updated);
    determined += 1;
    next[candidate.index] = {
      ...item,
      raw: {
        ...raw,
        challenge: {
          standard: updated.standard,
          outcome: updated.outcome,
          role: updated.role,
          quote: updated.quote,
          basis: updated.basis,
          excerpts: updated.excerpts,
          excerptSource: updated.excerptSource,
        },
        findingsRegardingExpert: updated.note,
      },
    };
  }
  return { evidence: next, determined };
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
