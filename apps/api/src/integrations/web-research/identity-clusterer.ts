import { findMentions, type IdentitySubject } from './identity-assess';
import {
  parseCityState,
  stateCode,
  stateName,
} from '../expert-research/live/location';
import type {
  MatchConfidence,
  WebCandidate,
  WebRecord,
} from './web-research.types';

export interface Fingerprint {
  /** Name as written, e.g. "Jason B. Demery". */
  written: string | null;
  credential: string | null;
  state: string | null;
}

const CREDENTIALS = [
  'MD',
  'M.D.',
  'DO',
  'D.O.',
  'PhD',
  'Ph.D.',
  'PsyD',
  'Esq',
  'DDS',
  'DMD',
  'DC',
  'DPM',
  'NP',
  'PA-C',
  'RN',
  'CPA',
  'PE',
  'JD',
];

/** What distinguishes the person on a page: written name form, credential, state. */
export function fingerprintOf(
  text: string,
  subject: IdentitySubject,
): Fingerprint {
  const mentions = findMentions(text, subject.name).filter(
    (m) => m.relation !== 'surname_only',
  );
  const mention = mentions[0];
  if (!mention) return { written: null, credential: null, state: null };
  const after = text.slice(mention.index, mention.index + 260);
  const before = text.slice(Math.max(0, mention.index - 160), mention.index);
  const credential =
    CREDENTIALS.find((c) =>
      new RegExp(`(?:,|\\s)${c.replace(/\./g, '\\.')}(?![A-Za-z])`).test(
        after.slice(0, 80),
      ),
    ) ?? null;
  let state: string | null = null;
  const window = `${before} ${after}`;
  const coded = window.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*([A-Z]{2})\b/);
  if (coded) state = stateCode(coded[1]);
  if (!state) {
    for (const code of [
      'FL',
      'TX',
      'CA',
      'NY',
      'GA',
      'AZ',
      'OH',
      'PA',
      'IL',
      'NC',
      'TN',
      'VA',
      'MI',
      'NJ',
      'WA',
      'MA',
    ]) {
      const full = stateName(code);
      if (full && new RegExp(`\\b${full}\\b`).test(window)) {
        state = code;
        break;
      }
    }
  }
  return { written: mention.written, credential, state };
}

function middleOf(written: string | null): string {
  if (!written) return '';
  const parts = written.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  return parts.length >= 3 ? parts[1].toLowerCase() : '';
}

function confidenceFrom(records: WebRecord[]): MatchConfidence {
  if (records.some((r) => r.match.level === 'strong')) return 'high';
  if (records.some((r) => r.match.level === 'possible')) return 'medium';
  return 'low';
}

/**
 * Separates pages that belong to the subject from pages about other people
 * with the same name. Pages are never merged across candidates: a page joins
 * the subject only when the profession, place, NPI or intake note agrees.
 */
export function clusterRecords(
  records: WebRecord[],
  fingerprints: ReadonlyMap<string, Fingerprint>,
  subject: IdentitySubject,
  subjectLabel: string,
): { candidates: WebCandidate[]; records: WebRecord[] } {
  const subjectRecords: WebRecord[] = [];
  const possibleRecords: WebRecord[] = [];
  const groups = new Map<
    string,
    { label: string; basis: string[]; records: WebRecord[] }
  >();
  const unconfirmed: WebRecord[] = [];

  for (const record of records) {
    if (record.match.level === 'none') continue;
    if (record.match.level === 'strong') {
      subjectRecords.push(record);
      continue;
    }
    if (record.match.level === 'possible') {
      possibleRecords.push(record);
      continue;
    }
    const fingerprint = fingerprints.get(record.id);
    // A page is a different person only on positive evidence: another middle
    // name, or a different state than the one given. A credential alone, or
    // a page that simply says nothing, stays "unconfirmed".
    const subjectState = parseCityState(subject.city || '').state;
    const subjectMiddle = subject.name.middle[0]?.toLowerCase() ?? '';
    const pageMiddle = middleOf(fingerprint?.written ?? null);
    const differentMiddle =
      Boolean(pageMiddle && subjectMiddle) &&
      pageMiddle[0] !== subjectMiddle[0];
    const differentState = Boolean(
      fingerprint?.state && subjectState && fingerprint.state !== subjectState,
    );
    const distinguishing = differentMiddle || differentState;
    if (record.match.level === 'other_person' || distinguishing) {
      const key = `${middleOf(fingerprint?.written ?? null)}|${fingerprint?.state ?? ''}|${fingerprint?.credential ?? ''}`;
      const group = groups.get(key) ?? {
        label: otherLabel(subject, fingerprint ?? null),
        basis: [],
        records: [],
      };
      for (const line of [
        ...record.match.conflicts,
        ...record.match.basis,
      ].slice(0, 2)) {
        if (!group.basis.includes(line)) group.basis.push(line);
      }
      group.records.push(record);
      groups.set(key, group);
    } else {
      unconfirmed.push(record);
    }
  }

  const candidates: WebCandidate[] = [];
  if (subjectRecords.length > 0) {
    candidates.push({
      id: 'cand-subject',
      label: subjectLabel,
      role: 'subject',
      confidence: confidenceFrom(subjectRecords),
      basis: [
        `${subjectRecords.length} page${subjectRecords.length === 1 ? '' : 's'} match the name together with the profession, place, NPI or intake-note details given.`,
      ],
      recordIds: subjectRecords.map((r) => r.id),
    });
  }
  if (possibleRecords.length > 0) {
    candidates.push({
      id: 'cand-possible',
      label: `Possible match pages for ${subjectLabel.split(',')[0]} (not treated as confirmed credentials)`,
      role: 'other',
      confidence: 'medium',
      basis: [
        'These pages only partly agree with the name, profession or place given. They are listed as possible matches and are not treated as the subject’s credentials.',
      ],
      recordIds: possibleRecords.map((r) => r.id),
    });
  }
  let index = 0;
  for (const group of groups.values()) {
    index += 1;
    candidates.push({
      id: `cand-other-${index}`,
      label: group.label,
      role: 'other',
      confidence: confidenceFrom(group.records) === 'low' ? 'low' : 'medium',
      basis: group.basis,
      recordIds: group.records.map((r) => r.id),
    });
  }
  if (unconfirmed.length > 0) {
    candidates.push({
      id: 'cand-unconfirmed',
      label: `Unconfirmed pages naming ${subjectLabel.split(',')[0]} (nothing ties them to this person or to someone else)`,
      role: 'other',
      confidence: 'low',
      basis: [
        'The name appears, but the profession, place and NPI given do not appear next to it. These pages are not attributed to the subject.',
      ],
      recordIds: unconfirmed.map((r) => r.id),
    });
  }

  const assignment = new Map<string, string>();
  for (const candidate of candidates) {
    for (const id of candidate.recordIds) assignment.set(id, candidate.id);
  }
  return {
    candidates,
    records: records.map((record) => ({
      ...record,
      candidateId: assignment.get(record.id) ?? null,
    })),
  };
}

function otherLabel(
  subject: IdentitySubject,
  fingerprint: Fingerprint | null,
): string {
  const written =
    fingerprint?.written ?? `${subject.name.first} ${subject.name.last}`;
  const parts = [
    capitalizeEach(written),
    fingerprint?.credential ?? null,
    fingerprint?.state ? stateName(fingerprint.state) : null,
  ].filter(Boolean);
  return `Another person: ${parts.join(', ')}`;
}

function capitalizeEach(value: string): string {
  return value.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}
