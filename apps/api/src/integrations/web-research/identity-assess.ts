import {
  capitalizeName,
  firstNamesCompatible,
  parsePersonName,
  type PersonName,
} from '../expert-research/live/person-name';
import { parseCityState } from '../expert-research/live/location';
import { specialtyStems } from '../expert-research/live/specialty-match';
import type { MatchConfidence, MatchLevel } from './web-research.types';

export interface IdentitySubject {
  name: PersonName;
  /** Optional. May be empty or a "City, ST" string. */
  city: string;
  specialty: string;
  npi?: string;
  context?: string;
}

export type NameMatch = 'full' | 'initial' | 'surname_only' | 'none';

export interface IdentityAssessment {
  nameMatch: NameMatch;
  level: MatchLevel;
  confidence: MatchConfidence | null;
  basis: string[];
  conflicts: string[];
  /** Verbatim text around the best name mention. */
  quote: string | null;
  corroboration: {
    npi: boolean;
    city: boolean;
    specialty: boolean;
    context: string[];
  };
}

const TITLE =
  /^(dr|doctor|prof|professor|mr|mrs|ms|miss|hon|judge|rev|sgt|det|officer|capt|lt)\.?$/i;
const STOP_WORDS = new Set([
  'about',
  'also',
  'because',
  'being',
  'should',
  'would',
  'their',
  'there',
  'these',
  'those',
  'which',
  'where',
  'while',
  'with',
  'from',
  'have',
  'that',
  'this',
  'please',
  'look',
  'search',
  'expert',
  'witness',
  'doctor',
  'check',
  'find',
  'information',
  'investigate',
  'investigation',
  'name',
  'known',
  'formerly',
  'works',
  'work',
  'worked',
  'practice',
  'practices',
  'office',
  'case',
  'cases',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018]/g, "'");
}

/** Distinctive words of a free-text profession, for any field. */
export function professionTerms(specialty: string): string[] {
  const stems = specialtyStems(specialty);
  if (stems.length > 0) return stems;
  return [
    ...new Set(
      specialty
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    ),
  ].map((w) => w.replace(/(ists?|ers?|ors?|ing|s)$/, ''));
}

/** Names and phrases from the attorney's note that a page might repeat. */
export function contextTerms(context: string | undefined): string[] {
  if (!context) return [];
  const terms = new Set<string>();
  for (const match of context.matchAll(/["“]([^"”]{3,80})["”]/g)) {
    terms.add(match[1].trim().toLowerCase());
  }
  for (const match of context.matchAll(
    /\b(?:[A-Z][\p{L}&'.-]+)(?:\s+(?:of|and|the|&|[A-Z][\p{L}&'.-]+))*(?:\s+[A-Z][\p{L}&'.-]+)?/gu,
  )) {
    const value = match[0].trim();
    if (value.length >= 4 && !STOP_WORDS.has(value.toLowerCase())) {
      terms.add(value.toLowerCase());
    }
  }
  return [...terms].slice(0, 16);
}

type Relation =
  'full' | 'full_conflict' | 'initial' | 'surname_only' | 'different_first';

export interface Mention {
  index: number;
  relation: Relation;
  written: string;
}

function tokensBefore(text: string, index: number): string[] {
  const before = text.slice(Math.max(0, index - 80), index);
  const tokens = before
    .split(/[\s,;:()"“”]+/)
    .filter(Boolean)
    .slice(-4);
  // Walk back from the surname while tokens look like name parts.
  const result: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && result.length < 3; i--) {
    const token = tokens[i];
    if (TITLE.test(token)) break;
    if (!/^\p{Lu}[\p{L}'.-]*$/u.test(token)) break;
    result.unshift(token);
  }
  return result;
}

function classify(
  subject: PersonName,
  before: string[],
  after: string,
): { relation: Relation; written: string } {
  const last = capitalizeName(subject.last);
  const clean = (t: string) => fold(t).toLowerCase().replace(/[.']/g, '');
  const parts = before.map(clean);
  const subjectMiddle = subject.middle[0] ?? '';

  const middleConflict = (middle: string): boolean => {
    if (!subjectMiddle || !middle) return false;
    if (middle.length === 1 || subjectMiddle.length === 1) {
      return middle[0] !== subjectMiddle[0];
    }
    return middle !== subjectMiddle;
  };

  // "Demery, Jason A." (last name first).
  const reversed = after.match(
    /^\s*,\s*(\p{Lu}[\p{L}'.-]*)(?:\s+(\p{Lu}[\p{L}'.-]*))?/u,
  );
  if (reversed) {
    const first = clean(reversed[1]);
    if (firstNamesCompatible(first, subject.first)) {
      const middle = reversed[2] ? clean(reversed[2]) : '';
      const looksLikeMiddle = middle.length >= 1 && middle.length <= 2;
      if (looksLikeMiddle && middleConflict(middle)) {
        return {
          relation: 'full_conflict',
          written: `${reversed[1]} ${reversed[2]} ${last}`,
        };
      }
      return {
        relation: first.length === 1 ? 'initial' : 'full',
        written: `${last}, ${reversed[1]}`,
      };
    }
  }

  if (parts.length === 0) return { relation: 'surname_only', written: last };

  const direct = parts[parts.length - 1];
  const earlier = parts.length >= 2 ? parts[parts.length - 2] : '';
  // Only the words that form the name, not a capitalised word that starts the sentence.
  const lastWord = before[before.length - 1];
  const written = [lastWord, last].join(' ');
  const writtenWithMiddle = [before[before.length - 2], lastWord, last].join(
    ' ',
  );

  // "Jason Demery" / "J. Demery" / "J Demery".
  if (firstNamesCompatible(direct, subject.first)) {
    return {
      relation:
        direct.length === 1 || /^[a-z]\.?$/i.test(lastWord)
          ? 'initial'
          : 'full',
      written,
    };
  }
  // "Jason A. Demery" / "Jason Allen Demery" / "J.A. Demery".
  if (earlier && firstNamesCompatible(earlier, subject.first)) {
    if (middleConflict(direct)) {
      return { relation: 'full_conflict', written: writtenWithMiddle };
    }
    return {
      relation: earlier.length === 1 ? 'initial' : 'full',
      written: writtenWithMiddle,
    };
  }
  // Dotted initials "J.A." became "ja" after cleaning.
  if (direct.length === 2 && /^[a-z]{2}$/.test(direct) && /\./.test(lastWord)) {
    if (firstNamesCompatible(direct[0], subject.first)) {
      return {
        relation: middleConflict(direct[1]) ? 'full_conflict' : 'initial',
        written,
      };
    }
  }
  // Another first name with the same surname is another person, not a conflict.
  if (direct.length > 1 && !TITLE.test(direct)) {
    return { relation: 'different_first', written };
  }
  return { relation: 'surname_only', written: last };
}

export function findMentions(text: string, subject: PersonName): Mention[] {
  const folded = fold(text);
  const last = escapeRegExp(fold(subject.last).replace(/\s+/g, ' '));
  const pattern = new RegExp(
    `(?<![\\p{L}])${last.replace(/ /g, '\\s+')}(?![\\p{L}])`,
    'giu',
  );
  const mentions: Mention[] = [];
  for (const match of folded.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = tokensBefore(folded, index);
    const after = folded.slice(
      index + match[0].length,
      index + match[0].length + 40,
    );
    const { relation, written } = classify(subject, before, after);
    mentions.push({ index, relation, written });
    if (mentions.length >= 200) break;
  }
  return mentions;
}

function windowAround(text: string, index: number, size: number): string {
  return text.slice(Math.max(0, index - size), index + size);
}

function quoteAround(text: string, index: number): string {
  const start = Math.max(0, index - 140);
  const end = Math.min(text.length, index + 220);
  let slice = text.slice(start, end);
  // Trim to whole words.
  if (start > 0) slice = slice.replace(/^\S*\s/, '');
  if (end < text.length) slice = slice.replace(/\s\S*$/, '');
  return slice.replace(/\s+/g, ' ').trim();
}

/**
 * Deterministic test of whether a page's text is about the subject. It looks
 * at how the name is written and whether the profession, place, NPI, or
 * attorney-supplied terms appear near it. A name alone is never "strong".
 */
export function assessIdentity(
  page: { title?: string | null; text: string },
  subject: IdentitySubject,
  options: { limitedText?: boolean } = {},
): IdentityAssessment {
  const text = `${page.title ?? ''}\n${page.text}`;
  const mentions = findMentions(text, subject.name);
  const full = mentions.filter((m) => m.relation === 'full');
  const initials = mentions.filter((m) => m.relation === 'initial');
  const conflicting = mentions.filter((m) => m.relation === 'full_conflict');
  const surname = mentions.filter((m) => m.relation === 'surname_only');

  const conflicts: string[] = [];
  if (conflicting.length > 0) {
    const sample = [...new Set(conflicting.map((m) => m.written))].slice(0, 2);
    conflicts.push(
      `The page names "${sample.join('" and "')}", with a middle name or initial that differs from ${subjectLabel(subject.name)}.`,
    );
  }

  const nameMatch: NameMatch =
    full.length > 0
      ? 'full'
      : initials.length > 0
        ? 'initial'
        : surname.length > 0
          ? 'surname_only'
          : 'none';

  const anchors = [
    ...full,
    ...initials,
    ...(nameMatch === 'surname_only' ? surname : []),
  ];
  const near = anchors
    .slice(0, 12)
    .map((m) => windowAround(fold(text), m.index, 700).toLowerCase())
    .join('\n');

  const npiOnPage = Boolean(
    subject.npi && new RegExp(`\\b${subject.npi}\\b`).test(text),
  );
  const terms = professionTerms(subject.specialty);
  const nearStems = terms.length > 0 ? specialtyStems(near) : [];
  const specialtyNear =
    terms.length > 0 &&
    terms.some(
      (t) =>
        near.includes(t) ||
        nearStems.some((w) => w.startsWith(t) || t.startsWith(w)),
    );
  const { city } = parseCityState(subject.city || '');
  const cityLower = city.toLowerCase();
  const cityNear = cityLower.length > 2 && near.includes(cityLower);
  const contextHits = contextTerms(subject.context).filter((term) =>
    near.includes(fold(term)),
  );

  const basis: string[] = [];
  const bestMention = full[0] ?? initials[0] ?? surname[0];
  const quote =
    bestMention && nameMatch !== 'none'
      ? quoteAround(text, bestMention.index)
      : null;

  if (nameMatch === 'none' && conflicting.length > 0) {
    return {
      nameMatch,
      level: 'other_person',
      confidence: 'medium',
      basis: ['The only full-name mentions differ from the subject.'],
      conflicts,
      quote: quoteAround(text, conflicting[0].index),
      corroboration: {
        npi: npiOnPage,
        city: false,
        specialty: false,
        context: [],
      },
    };
  }
  if (nameMatch === 'none') {
    return {
      nameMatch,
      level: 'none',
      confidence: null,
      basis: ['The surname does not appear in the retrieved text.'],
      conflicts,
      quote: null,
      corroboration: {
        npi: npiOnPage,
        city: false,
        specialty: false,
        context: [],
      },
    };
  }

  basis.push(
    nameMatch === 'full'
      ? `The full name is written on the page (${full[0].written}).`
      : nameMatch === 'initial'
        ? `The name appears with initials only (${initials[0].written}).`
        : 'Only the surname appears, without a first name.',
  );
  if (npiOnPage) basis.push(`NPI ${subject.npi} appears on the page.`);
  if (specialtyNear)
    basis.push(
      `"${subject.specialty}" or a related term appears next to the name.`,
    );
  if (cityNear) basis.push(`${city} appears next to the name.`);
  if (contextHits.length > 0) {
    basis.push(
      `Terms from the intake note appear next to the name: ${contextHits.slice(0, 4).join(', ')}.`,
    );
  }

  const corroborators =
    (npiOnPage ? 2 : 0) +
    (specialtyNear ? 1 : 0) +
    (cityNear ? 1 : 0) +
    (contextHits.length > 0 ? 1 : 0);

  let level: MatchLevel;
  let confidence: MatchConfidence | null;
  if (nameMatch === 'full' || nameMatch === 'initial') {
    if (corroborators >= 2) {
      level = nameMatch === 'full' ? 'strong' : 'possible';
      confidence = nameMatch === 'full' ? 'high' : 'medium';
    } else if (corroborators === 1) {
      level = 'possible';
      confidence = 'medium';
    } else {
      level = 'weak';
      confidence = 'low';
      basis.push(
        'Nothing on the page ties this name to the profession or place given, so it may be a different person.',
      );
    }
  } else {
    level = corroborators >= 2 ? 'possible' : 'weak';
    confidence = 'low';
  }

  if (conflicting.length > 0 && full.length === 0) {
    level = 'other_person';
    confidence = 'medium';
    basis.push('The only full-name mentions differ from the subject.');
  } else if (conflicting.length > 0 && level === 'strong') {
    level = 'possible';
    confidence = 'medium';
    basis.push(
      'The page also names a similarly named person with a different middle name or initial.',
    );
  }

  if (options.limitedText && (level === 'strong' || level === 'possible')) {
    if (level === 'strong') level = 'possible';
    confidence = 'low';
    basis.push('Only a search excerpt was available, not the full page.');
  }

  return {
    nameMatch,
    level,
    confidence,
    basis,
    conflicts,
    quote,
    corroboration: {
      npi: npiOnPage,
      city: Boolean(cityNear),
      specialty: specialtyNear,
      context: contextHits,
    },
  };
}

function subjectLabel(name: PersonName): string {
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  return [
    name.first,
    ...name.middle.map((m) => (m.length === 1 ? `${m.toUpperCase()}.` : m)),
    name.last,
  ]
    .map(cap)
    .join(' ');
}

export function subjectFromQuery(query: {
  expertName: string;
  city?: string;
  specialty: string;
  npi?: string;
  context?: string;
}): IdentitySubject | null {
  const name = parsePersonName(query.expertName);
  if (!name) return null;
  return {
    name,
    city: query.city ?? '',
    specialty: query.specialty,
    npi: query.npi,
    context: query.context,
  };
}
