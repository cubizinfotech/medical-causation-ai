import type { CvCheck, CvClaim, CvExtraction } from '../../cv/cv.types';
import type {
  AffiliationEntry,
  AffiliationTimeframe,
  InstitutionalRelationshipType,
} from './affiliation.types';

const YEAR = /\b((?:19|20)\d{2})\b/g;

/** Membership / society — not institutional appointment. */
const MEMBERSHIP_ONLY =
  /\b(member(?:ship)?|fellow of|affiliate of|member of the)\b/i;

/** Degree-only lines — not employment. */
const DEGREE_ONLY =
  /\b(ph\.?\s*d\.?|psy\.?\s*d\.?|m\.?\s*d\.?|m\.?\s*a\.?|m\.?\s*s\.?|b\.?\s*a\.?|b\.?\s*s\.?|ed\.?\s*d\.?|d\.?\s*o\.?|bachelor|master(?:'?s)?|doctorate|graduated|degree in)\b/i;

/** Publishers / journals — not employers. */
const PUBLISHER =
  /\b(wiley|elsevier|springer|sage publications|taylor\s*&\s*francis|oxford university press|cambridge university press|wolters kluwer|nature publishing|ieee|acm\b|journal of|proceedings of)\b/i;

const TRAINING_CUE =
  /\b(practicum|internship|intern\b|externship|residency|fellow(?:ship)?|clinical training|training site|supervised (?:clinical )?experience|predoctoral|postdoctoral training)\b/i;

const APPOINTMENT_CUE =
  /\b(professor|faculty|adjunct|visiting (?:professor|faculty)|instructor|lecturer|attending|clinical (?:assistant|associate)?\s*professor|director|chief of|staff (?:physician|psychologist)|hospital (?:privileges|staff)|appointment|appointed)\b/i;

const PRACTICUM_CUE =
  /\b(practicum|externship|clinical training (?:site|location)|site supervisor|training placement)\b/i;

const INTERNSHIP_CUE = /\b(internship|intern\b|predoctoral intern)\b/i;

const RESIDENCY_FELLOWSHIP_CUE =
  /\b(residency|resident\b|fellowship|fellow\b|postdoctoral fellow)\b/i;

const HOSPITAL_CUE =
  /\b(hospital|medical center|clinic|health system|staff privileges|attending)\b/i;

const RESEARCH_CUE =
  /\b(research (?:scientist|associate|fellow|appointment)|investigator|principal investigator)\b/i;

const TEACHING_CUE =
  /\b(instructor|lecturer|teaching (?:assistant|faculty)|course instructor)\b/i;

const ADJUNCT_CUE = /\b(adjunct|visiting (?:professor|faculty|scholar))\b/i;

const CLINICAL_APPT_CUE =
  /\b(clinical (?:assistant|associate)?\s*professor|clinical faculty|clinical appointment)\b/i;

const FACULTY_CUE =
  /\b((?:assistant|associate|full)?\s*professor|faculty)\b/i;

function haystack(claim: CvClaim): string {
  return [
    claim.statement,
    claim.quote,
    claim.details.institution,
    claim.details.title,
    claim.details.name,
    claim.details.degree,
    claim.details.company,
    claim.details.role,
  ]
    .filter(Boolean)
    .join(' ');
}

function parseYears(text: string): { start: number | null; end: number | null } {
  const years = [
    ...new Set([...text.matchAll(YEAR)].map((m) => Number(m[1]))),
  ].sort((a, b) => a - b);
  if (years.length === 0) return { start: null, end: null };
  if (years.length === 1) return { start: years[0], end: null };
  return { start: years[0], end: years[years.length - 1] };
}

function timeframeFrom(
  text: string,
  start: number | null,
  end: number | null,
): AffiliationTimeframe {
  const currentYear = new Date().getFullYear();
  const looksCurrent = /(present|current|ongoing)/i.test(text);
  if (looksCurrent && (end == null || end >= currentYear)) return 'current';
  if (end != null && end < currentYear && !looksCurrent) return 'historical';
  if (start != null && !end && start < currentYear - 1 && !looksCurrent) {
    return 'historical';
  }
  if (start == null && end == null) return 'undated';
  if (end != null && end >= currentYear) return 'current';
  if (start != null && !end) return 'current';
  return 'unknown';
}

function pickInstitution(claim: CvClaim): string | null {
  const fromDetails = claim.details.institution?.replace(/\s+/g, ' ').trim();
  if (fromDetails && fromDetails.length >= 3) return fromDetails.slice(0, 160);
  const company = claim.details.company?.replace(/\s+/g, ' ').trim();
  if (company && company.length >= 3 && !PUBLISHER.test(company)) {
    return company.slice(0, 160);
  }
  const statement = claim.statement.replace(/\s+/g, ' ').trim();
  const inst = statement.match(
    /\b((?:[A-Z][A-Za-z&.\-']+\s+){0,6}(?:University|College|Institute|School|Hospital|Medical Center|Health System|Clinic)[^,;.]{0,40})/,
  );
  if (inst?.[1]) return inst[1].replace(/\s+/g, ' ').trim().slice(0, 160);
  return null;
}

function pickTitle(claim: CvClaim): string | null {
  if (claim.details.title?.trim()) {
    return claim.details.title.trim().slice(0, 120);
  }
  const statement = claim.statement.replace(/\s+/g, ' ').trim();
  const title = statement.match(
    /\b((?:Clinical|Assistant|Associate|Adjunct|Visiting|Full)?\s*(?:Professor|Faculty|Instructor|Attending|Director|Chief|Intern|Resident|Fellow|Practicum Student)[^,;.]{0,60})/i,
  );
  return title?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? null;
}

function pickDepartment(claim: CvClaim): string | null {
  const hay = haystack(claim);
  const dept = hay.match(
    /\b(?:Department of|Dept\.?\s+of)\s+([^,;.]{3,80})/i,
  );
  return dept?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 100) ?? null;
}

function looksLikeMembership(claim: CvClaim): boolean {
  const hay = haystack(claim);
  if (claim.category === 'membership') return true;
  if (
    MEMBERSHIP_ONLY.test(hay) &&
    !APPOINTMENT_CUE.test(hay) &&
    !TRAINING_CUE.test(hay)
  ) {
    return true;
  }
  return false;
}

function looksLikeDegreeOnly(claim: CvClaim): boolean {
  const hay = haystack(claim);
  if (
    claim.category === 'education' &&
    DEGREE_ONLY.test(hay) &&
    !TRAINING_CUE.test(hay)
  ) {
    if (!/\b(residency|internship|practicum|fellowship)\b/i.test(hay)) {
      return true;
    }
  }
  if (
    DEGREE_ONLY.test(hay) &&
    !APPOINTMENT_CUE.test(hay) &&
    !TRAINING_CUE.test(hay) &&
    claim.category !== 'appointment' &&
    claim.category !== 'training'
  ) {
    return true;
  }
  return false;
}

function looksLikePublisher(claim: CvClaim): boolean {
  return PUBLISHER.test(haystack(claim));
}

/**
 * Classify relationship type from claim wording.
 * Training cues dominate over appointment when both appear weakly.
 */
export function classifyRelationshipType(
  claim: CvClaim,
): InstitutionalRelationshipType | null {
  if (looksLikeMembership(claim) || looksLikePublisher(claim)) return null;
  if (looksLikeDegreeOnly(claim)) return null;

  const hay = haystack(claim);
  const trainingDominant =
    TRAINING_CUE.test(hay) &&
    (!APPOINTMENT_CUE.test(hay) ||
      PRACTICUM_CUE.test(hay) ||
      INTERNSHIP_CUE.test(hay) ||
      RESIDENCY_FELLOWSHIP_CUE.test(hay));

  if (trainingDominant || claim.category === 'training') {
    if (PRACTICUM_CUE.test(hay)) return 'practicum_placement';
    if (INTERNSHIP_CUE.test(hay)) return 'internship';
    if (RESIDENCY_FELLOWSHIP_CUE.test(hay)) {
      return 'residency_fellowship_training';
    }
    return 'residency_fellowship_training';
  }

  if (claim.category === 'education' && TRAINING_CUE.test(hay)) {
    if (PRACTICUM_CUE.test(hay)) return 'practicum_placement';
    if (INTERNSHIP_CUE.test(hay)) return 'internship';
    return 'residency_fellowship_training';
  }

  if (!APPOINTMENT_CUE.test(hay) && claim.category !== 'appointment') {
    return null;
  }

  if (ADJUNCT_CUE.test(hay)) return 'adjunct_visiting_faculty';
  if (CLINICAL_APPT_CUE.test(hay)) return 'clinical_appointment';
  if (HOSPITAL_CUE.test(hay) && /\b(staff|attending|privileges)\b/i.test(hay)) {
    return 'hospital_staff_appointment';
  }
  if (RESEARCH_CUE.test(hay) && !FACULTY_CUE.test(hay)) {
    return 'research_appointment';
  }
  if (TEACHING_CUE.test(hay) && !FACULTY_CUE.test(hay)) {
    return 'teaching_appointment';
  }
  if (FACULTY_CUE.test(hay)) return 'faculty_appointment';
  if (claim.category === 'appointment') return 'academic_appointment';
  return 'professional_affiliation';
}

function isTrainingClass(type: InstitutionalRelationshipType): boolean {
  return (
    type === 'practicum_placement' ||
    type === 'internship' ||
    type === 'residency_fellowship_training' ||
    type === 'educational_institution'
  );
}

function entryFromClaim(
  claim: CvClaim,
  cvSourceUrl: string | null,
  index: number,
): AffiliationEntry | null {
  const relationshipType = classifyRelationshipType(claim);
  if (!relationshipType) return null;

  const hay = haystack(claim);
  const { start, end } = parseYears(hay);
  const timeframe = timeframeFrom(hay, start, end);
  const institution = pickInstitution(claim);
  const title = pickTitle(claim);
  const classKind: 'appointment' | 'training' = isTrainingClass(relationshipType)
    ? 'training'
    : 'appointment';

  let type = relationshipType;
  if (
    classKind === 'appointment' &&
    timeframe === 'historical' &&
    !/\b(present|current|ongoing)\b/i.test(hay)
  ) {
    type = 'historical_appointment';
  }

  const confidence: AffiliationEntry['extractionConfidence'] =
    institution && title
      ? 'high'
      : institution || title
        ? 'medium'
        : 'low';

  return {
    id: `affil-${index + 1}`,
    institution,
    department: pickDepartment(claim),
    title,
    relationshipType: type,
    timeframe,
    startYear: start,
    endYear: end,
    location: null,
    statement: claim.statement.replace(/\s+/g, ' ').trim().slice(0, 400),
    quote: (claim.quote || claim.statement)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280),
    page: claim.page ?? null,
    cvSourceUrl,
    claimId: claim.id ?? null,
    class: classKind,
    extractionConfidence: confidence,
  };
}

/**
 * Extract institutional affiliation / training entries from CV claims.
 * Rejects membership, publisher, and degree-only lines.
 */
export function affiliationEntriesFromClaims(
  claims: CvClaim[],
  options: { cvSourceUrl?: string | null } = {},
): AffiliationEntry[] {
  const relevant = claims.filter((c) => {
    if (
      c.category === 'appointment' ||
      c.category === 'training' ||
      c.category === 'education'
    ) {
      return true;
    }
    if (APPOINTMENT_CUE.test(haystack(c)) || TRAINING_CUE.test(haystack(c))) {
      return c.category !== 'membership' && c.category !== 'publication';
    }
    return false;
  });

  const entries: AffiliationEntry[] = [];
  const seen = new Set<string>();
  let index = 0;
  for (const claim of relevant) {
    const entry = entryFromClaim(claim, options.cvSourceUrl ?? null, index);
    if (!entry) continue;
    const key = [
      entry.class,
      (entry.institution ?? '').toLowerCase(),
      (entry.title ?? '').toLowerCase(),
      entry.statement.slice(0, 80).toLowerCase(),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ ...entry, id: `affil-${entries.length + 1}` });
    index += 1;
  }
  return entries;
}

export function affiliationEntriesFromExtraction(
  extraction: CvExtraction | null | undefined,
): AffiliationEntry[] {
  if (!extraction) return [];
  return affiliationEntriesFromClaims(extraction.claims, {
    cvSourceUrl: extraction.document.id || null,
  });
}

export function affiliationEntriesFromCvCheck(
  check: CvCheck | null | undefined,
): AffiliationEntry[] {
  if (!check) return [];
  return affiliationEntriesFromClaims(check.claims, {
    cvSourceUrl: check.document.id || null,
  });
}
