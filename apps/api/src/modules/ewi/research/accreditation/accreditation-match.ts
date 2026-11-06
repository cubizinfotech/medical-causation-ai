import type {
  AccreditationKind,
  AccreditationSourceHit,
  AccreditationStatus,
  EducationDegreeEntry,
} from './accreditation.types';

export const APA_HOST =
  /accreditation\.apa\.org|apa\.org\/ed\/accreditation/i;
export const CHEA_HOST = /chea\.org/i;
export const USDE_HOST = /ope\.ed\.gov|nces\.ed\.gov|studentaid\.gov/i;

export function isOfficialAccreditorUrl(url: string): boolean {
  return APA_HOST.test(url) || CHEA_HOST.test(url) || USDE_HOST.test(url);
}

export function accreditationKindForUrl(url: string): AccreditationKind | null {
  if (APA_HOST.test(url)) return 'apa_program';
  if (CHEA_HOST.test(url) || USDE_HOST.test(url)) return 'institutional';
  return null;
}

/** Loose institution token match — rejects near-miss university names. */
export function institutionAppearsIn(
  institution: string | null | undefined,
  text: string,
): boolean {
  if (!institution) return false;
  const hay = text.toLowerCase().replace(/\s+/g, ' ');
  const name = institution.toLowerCase().replace(/\s+/g, ' ').trim();
  if (name.length < 6) return false;
  if (hay.includes(name)) return true;
  // Require distinctive tokens (drop of/the/at/and) — at least 2 must hit,
  // and the longest distinctive token (≥5 chars) must appear.
  const tokens = name
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !['of', 'the', 'at', 'and', 'for', 'in', 'de'].includes(t),
    );
  if (tokens.length === 0) return false;
  const distinctive = tokens.filter((t) => t.length >= 5);
  const longest = [...distinctive].sort((a, b) => b.length - a.length)[0];
  if (longest && !hay.includes(longest)) return false;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

const PSYCH_PROGRAM =
  /\b(clinical|counseling|school)\s+psychology\b|\b(phd|psy\.?\s*d)\b.*\bpsycholog|\bpsycholog.*\b(phd|psy\.?\s*d)\b/i;

export function programAppearsIn(
  entry: EducationDegreeEntry,
  text: string,
): boolean {
  const hay = text.toLowerCase();
  const program = (entry.program ?? entry.fieldOfStudy ?? '').toLowerCase();
  if (program && hay.includes(program.toLowerCase())) return true;
  if (/\bclinical\b/i.test(`${entry.program ?? ''} ${entry.statement}`)) {
    return /\bclinical\s+psychology\b/i.test(text);
  }
  if (/\bcounseling\b/i.test(`${entry.program ?? ''} ${entry.statement}`)) {
    return /\bcounseling\s+psychology\b/i.test(text);
  }
  if (/\bschool\b/i.test(`${entry.program ?? ''} ${entry.statement}`)) {
    return /\bschool\s+psychology\b/i.test(text);
  }
  // Doctoral psych without a named program: accept any psych doctoral listing.
  if (entry.degreeKind === 'doctoral') {
    return PSYCH_PROGRAM.test(text) || /\bpsychology\b/i.test(text);
  }
  return false;
}

const YEAR = /\b((?:19|20)\d{2})\b/g;
const ACCREDITED_SINCE =
  /(?:accredited|accreditation)\s+(?:since|from|effective|beginning)\s+(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+)?((?:19|20)\d{2})/i;
const ACCREDITED_UNTIL =
  /(?:accredited|accreditation)\s+(?:until|through|to|ending)\s+(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+)?((?:19|20)\d{2})/i;
const CURRENTLY =
  /\b(currently accredited|accredited program|full accreditation|accredited status)\b/i;
const NOT_ACCREDITED =
  /\b(not accredited|accreditation (?:was |has been )?(?:withdrawn|revoked|denied)|no longer accredited)\b/i;

export function parseAccreditationDates(text: string): {
  fromYear: number | null;
  toYear: number | null;
  currentlyListed: boolean;
  affirmativelyNotAccredited: boolean;
} {
  const since = text.match(ACCREDITED_SINCE);
  const until = text.match(ACCREDITED_UNTIL);
  const years = [...text.matchAll(YEAR)].map((m) => Number(m[1]));
  let fromYear = since ? Number(since[1]) : null;
  let toYear = until ? Number(until[1]) : null;
  // Range like "accredited 1998–2010" or "1998-2010".
  const range = text.match(
    /(?:accredited|accreditation)[^\n.]{0,40}\b((?:19|20)\d{2})\s*[–\-—to]+\s*((?:19|20)\d{2})\b/i,
  );
  if (range) {
    fromYear = fromYear ?? Number(range[1]);
    toYear = toYear ?? Number(range[2]);
  }
  if (!fromYear && years.length === 1 && CURRENTLY.test(text)) {
    fromYear = years[0];
  }
  return {
    fromYear,
    toYear,
    currentlyListed: CURRENTLY.test(text) || (fromYear !== null && toYear === null),
    affirmativelyNotAccredited: NOT_ACCREDITED.test(text),
  };
}

export function statusFromHit(
  entry: EducationDegreeEntry,
  hit: AccreditationSourceHit | null,
  options: { requireProgramMatch?: boolean; programMatched?: boolean } = {},
): AccreditationStatus {
  if (!hit) return 'unable_to_verify';
  if (options.requireProgramMatch && options.programMatched === false) {
    return 'no_matching_program';
  }
  const attendanceStart = entry.startYear;
  const attendanceEnd = entry.endYear ?? entry.graduationYear;
  const hasPeriod =
    hit.accreditedFromYear !== null || hit.accreditedToYear !== null;
  if (
    hasPeriod &&
    attendanceEnd !== null &&
    hit.accreditedFromYear !== null &&
    attendanceEnd < hit.accreditedFromYear
  ) {
    // Attendance ended before accreditation began — only with affirmative dates.
    return 'not_accredited_during_period';
  }
  if (
    hasPeriod &&
    attendanceStart !== null &&
    hit.accreditedToYear !== null &&
    attendanceStart > hit.accreditedToYear
  ) {
    return 'not_accredited_during_period';
  }
  if (
    hasPeriod &&
    (attendanceStart !== null || attendanceEnd !== null) &&
    hit.accreditedFromYear !== null
  ) {
    const start = attendanceStart ?? attendanceEnd!;
    const end = attendanceEnd ?? attendanceStart!;
    const from = hit.accreditedFromYear;
    const to = hit.accreditedToYear ?? Number.POSITIVE_INFINITY;
    if (end >= from && start <= to) {
      return 'accredited_during_period';
    }
  }
  if (hit.currentlyListed || (!hasPeriod && hit.url)) {
    return 'currently_accredited';
  }
  if (hasPeriod) return 'accredited_during_period';
  return 'unable_to_verify';
}

export function assessmentDedupKey(
  entry: EducationDegreeEntry,
  apaStatus: AccreditationStatus,
  institutionalStatus: AccreditationStatus | null,
): string {
  return [
    (entry.institution ?? '').toLowerCase(),
    (entry.program ?? entry.fieldOfStudy ?? entry.degreeName ?? '').toLowerCase(),
    entry.graduationYear ?? entry.endYear ?? '',
    apaStatus,
    institutionalStatus ?? '',
  ].join('|');
}
