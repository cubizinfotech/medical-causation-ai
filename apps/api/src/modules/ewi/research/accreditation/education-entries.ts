import type { CvCheck, CvClaim, CvExtraction } from '../../cv/cv.types';
import type { DegreeKind, EducationDegreeEntry } from './accreditation.types';

const DEGREE_KIND: Array<{ kind: DegreeKind; pattern: RegExp }> = [
  {
    kind: 'doctoral',
    pattern: /\b(ph\.?\s*d\.?|psy\.?\s*d\.?|ed\.?\s*d\.?|doctor(?:ate|al)?|d\.?\s*o\.?)\b/i,
  },
  {
    kind: 'masters',
    pattern: /\b(m\.?\s*a\.?|m\.?\s*s\.?|m\.?\s*ed\.?|master(?:'?s)?)\b/i,
  },
  {
    kind: 'bachelors',
    pattern: /\b(b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'?s)?)\b/i,
  },
  { kind: 'internship', pattern: /\b(pre-?doctoral\s+)?internship\b/i },
  { kind: 'fellowship', pattern: /\bfellowship\b/i },
  { kind: 'residency', pattern: /\bresidency\b/i },
];

const INSTITUTION =
  /\b((?:[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,5}\s+)?(?:University|College|Institute|School)(?:\s+of\s+[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,4})?)/;

const FIELD =
  /\b((?:Clinical|Counseling|School|Forensic|Experimental|Cognitive|Developmental|Industrial|Organizational)?\s*Psychology|Neuropsychology|Psychiatry)\b/i;

const YEAR = /\b((?:19|20)\d{2})\b/g;

function classifyDegree(text: string, stated?: string): DegreeKind {
  const hay = `${stated ?? ''} ${text}`;
  for (const row of DEGREE_KIND) {
    if (row.pattern.test(hay)) return row.kind;
  }
  return 'unknown';
}

function yearsIn(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(YEAR)) {
    const year = Number(match[1]);
    if (year >= 1950 && year <= new Date().getFullYear() + 1) {
      found.push(year);
    }
  }
  return found;
}

function pickInstitution(
  detailsInstitution: string | undefined,
  statement: string,
): string | null {
  const fromDetails = detailsInstitution?.replace(/\s+/g, ' ').trim();
  if (fromDetails && fromDetails.length >= 4) return fromDetails;
  const match = statement.match(INSTITUTION);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function pickDegreeName(detailsDegree: string | undefined, statement: string): string | null {
  if (detailsDegree?.trim()) return detailsDegree.trim();
  const match = statement.match(
    /\b((?:Ph\.?\s*D\.?|Psy\.?\s*D\.?|Ed\.?\s*D\.?|M\.?\s*A\.?|M\.?\s*S\.?|B\.?\s*A\.?|B\.?\s*S\.?|Doctor of Philosophy|Master of Science|Bachelor of Arts|Bachelor of Science)[^,;\n]{0,80})/i,
  );
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function pickField(statement: string, degreeName: string | null): string | null {
  const hay = `${degreeName ?? ''} ${statement}`;
  const match = hay.match(FIELD);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function entryKey(entry: Omit<EducationDegreeEntry, 'id'>): string {
  return [
    (entry.institution ?? '').toLowerCase(),
    (entry.degreeName ?? entry.degreeKind).toLowerCase(),
    entry.graduationYear ?? entry.endYear ?? '',
    (entry.program ?? entry.fieldOfStudy ?? '').toLowerCase(),
  ].join('|');
}

/** Build structured education rows from CV claims. Missing fields stay null. */
export function educationEntriesFromClaims(
  claims: CvClaim[],
  options: { cvSourceUrl?: string | null } = {},
): EducationDegreeEntry[] {
  const byKey = new Map<string, EducationDegreeEntry>();
  let index = 0;
  for (const claim of claims) {
    if (claim.category !== 'education' && claim.category !== 'training') {
      continue;
    }
    const statement = claim.statement.replace(/\s+/g, ' ').trim();
    if (statement.length < 12) continue;
    const institution = pickInstitution(claim.details.institution, statement);
    const degreeName = pickDegreeName(claim.details.degree, statement);
    const degreeKind = classifyDegree(statement, claim.details.degree);
    const fieldOfStudy = pickField(statement, degreeName);
    const years = yearsIn(
      `${claim.details.year ?? ''} ${statement} ${claim.quote}`,
    );
    const graduationYear =
      parseYear(claim.details.year) ??
      (years.length === 1 ? years[0] : years.length > 1 ? years[years.length - 1] : null);
    const startYear = years.length >= 2 ? years[0] : null;
    const endYear =
      years.length >= 2 ? years[years.length - 1] : graduationYear;
    const program =
      fieldOfStudy &&
      /\b(clinical|counseling|school)\b/i.test(fieldOfStudy)
        ? fieldOfStudy
        : fieldOfStudy;
    const draft: Omit<EducationDegreeEntry, 'id'> = {
      institution,
      degreeName,
      degreeKind,
      program,
      fieldOfStudy,
      startYear,
      endYear,
      graduationYear,
      campus: null,
      statement: statement.slice(0, 400),
      quote: (claim.quote || statement).slice(0, 280),
      page: claim.page || null,
      cvSourceUrl: options.cvSourceUrl ?? null,
      claimId: claim.id,
    };
    const key = entryKey(draft);
    if (byKey.has(key)) continue;
    index += 1;
    byKey.set(key, { id: `edu-${index}`, ...draft });
  }
  return [...byKey.values()];
}

export function educationEntriesFromExtraction(
  extraction: CvExtraction | null | undefined,
): EducationDegreeEntry[] {
  if (!extraction) return [];
  return educationEntriesFromClaims(extraction.claims, {
    cvSourceUrl: extraction.document.id || null,
  });
}

export function educationEntriesFromCvCheck(
  check: CvCheck | null | undefined,
): EducationDegreeEntry[] {
  if (!check) return [];
  return educationEntriesFromClaims(check.claims, {
    cvSourceUrl: check.document.id || null,
  });
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b((?:19|20)\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1950 ? year : null;
}

/** True when APA CoA program accreditation may apply. */
export function apaProgramMayApply(
  entry: EducationDegreeEntry,
  specialty?: string | null,
): boolean {
  const psychSpecialty =
    /\b(psycholog|neuropsycholog|clinical psych|counseling psych|school psych)\b/i.test(
      specialty ?? '',
    );
  const psychField = /\b(psycholog|neuropsycholog)\b/i.test(
    `${entry.fieldOfStudy ?? ''} ${entry.program ?? ''} ${entry.statement}`,
  );
  if (entry.degreeKind === 'doctoral' && (psychSpecialty || psychField)) {
    return true;
  }
  // Doctoral psych without specialty cue still eligible when the CV says psychology.
  if (entry.degreeKind === 'doctoral' && psychField) return true;
  return false;
}

/** True when the entry is clearly outside APA doctoral-program scope. */
export function apaNotApplicable(
  entry: EducationDegreeEntry,
  specialty?: string | null,
): boolean {
  if (apaProgramMayApply(entry, specialty)) return false;
  if (
    entry.degreeKind === 'bachelors' ||
    entry.degreeKind === 'masters' ||
    entry.degreeKind === 'internship' ||
    entry.degreeKind === 'fellowship' ||
    entry.degreeKind === 'residency'
  ) {
    return true;
  }
  if (
    entry.degreeKind === 'other' ||
    entry.degreeKind === 'unknown'
  ) {
    // Non-psych specialty and no psych cues → not APA CoA scope.
    return !/\b(psycholog|neuropsycholog)\b/i.test(
      `${specialty ?? ''} ${entry.statement}`,
    );
  }
  return false;
}
