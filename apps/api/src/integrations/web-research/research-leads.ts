import { stateCode } from '../expert-research/live/location';

/**
 * Named programs, funders and institutions taken from Gemini's grounded
 * answer and from pages already read. These are search leads only: nothing
 * here is a finding until a fetched page or an official API supports it.
 */

export interface ResearchLeads {
  programs: string[];
  funders: string[];
  institutions: string[];
}

const PROGRAMS: readonly { key: string; pattern: RegExp }[] = [
  { key: 'TRACK-TBI', pattern: /\bTRACK[- ]?TBI\b/i },
  {
    key: 'TRANSFORMING RESEARCH AND CLINICAL KNOWLEDGE IN TBI',
    pattern:
      /\bTRANSFORMING RESEARCH AND CLINICAL KNOWLEDGE IN TRAUMATIC BRAIN INJURY\b/i,
  },
];

const FUNDERS: readonly { key: string; pattern: RegExp }[] = [
  { key: 'NIH', pattern: /\bNIH\b|National Institutes of Health/ },
  {
    key: 'DoD',
    pattern: /\bDoD\b|U\.?S\.?\s*Department of Defense|Department of Defense/,
  },
  { key: 'NINDS', pattern: /\bNINDS\b/ },
  { key: 'NSF', pattern: /\bNational Science Foundation\b|\bNSF\b/ },
];

/** "University of Florida", "College of William & Mary", with optional leading proper nouns. */
const INSTITUTION_OF =
  /\b(?:(?:[A-Z][A-Za-z&.'-]+\s+){0,4})?(?:University|College|Institute|School) of [A-Z][A-Za-z&'-]+(?: (?:at|of|and|the) [A-Z][A-Za-z&'-]+|(?: [A-Z][A-Za-z&'-]+)){0,5}/g;

/** "Florida State University", "John Jay College". */
const INSTITUTION_NAMED =
  /\b(?:[A-Z][A-Za-z&'-]+ ){1,4}(?:University|College|Institute)\b/g;

const NOT_PART_OF_NAME =
  /^(?:He|She|They|Dr|Mr|Ms|The|Her|His|In|At|And|From|With|After|Before|This|That|Our|Their)\s+/i;

const TRAILING_NOT_NAME =
  /\s+(?:He|She|They|Dr|Mr|Ms|The|Her|His|In|At|And|From|With|After|Before|This|That|Our|Their|An|A)\b.*$/i;

const GENERIC_SCHOOLS = new Set([
  'the university',
  'a university',
  'this university',
  'college of',
  'school of',
  'institute of',
  'university of',
]);

/** Fragments that are typically colleges/schools inside a parent university. */
const SUBUNIT =
  /\b(?:College|School|Institute|Department|Division|Program)\b/i;
const PARENT_UNIVERSITY = /\bUniversity\b/i;

function normalizeInstitutionName(raw: string): string | null {
  let name = raw.replace(/\s+/g, ' ').trim();
  // Cut at sentence punctuation so "University of Florida. He" truncates.
  name = name.split(/[.;:!?\n]/)[0]?.trim() ?? name;
  name = name.replace(/[.,;:]+$/, '').trim();
  name = name.replace(TRAILING_NOT_NAME, '').trim();
  while (NOT_PART_OF_NAME.test(name)) {
    name = name.replace(NOT_PART_OF_NAME, '').trim();
  }
  if (!/(University|College|Institute|School)/.test(name)) return null;
  const key = name.toLowerCase();
  if (GENERIC_SCHOOLS.has(key)) return null;
  if (name.split(/\s+/).length < 2) return null;
  return name;
}

/**
 * Prefer the longest overlapping institution mention and drop fragments that
 * are wholly contained in a longer university name. When a college/school
 * fragment sits next to a university in the same text, keep the university as
 * the primary accreditation subject.
 */
/** True when `shorter` is a name fragment inside `longer`, not a distinct school. */
function isContainedFragment(shorter: string, longer: string): boolean {
  const s = shorter.toLowerCase();
  const l = longer.toLowerCase();
  if (s === l || !l.includes(s)) return false;
  // "University of Florida" is not a fragment of "University of South Florida".
  const geo = /\b(south|north|east|west|central|new)\b/i;
  if (geo.test(l) && !geo.test(s)) return false;
  return true;
}

export function preferParentInstitutions(
  names: readonly string[],
  sourceText = '',
): string[] {
  const cleaned = names
    .map((name) => normalizeInstitutionName(name))
    .filter((name): name is string => Boolean(name));
  // Longest first so shorter contained fragments are dropped.
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const name of sorted) {
    if (kept.some((existing) => isContainedFragment(name, existing))) {
      continue;
    }
    kept.push(name);
  }

  if (!sourceText) return kept;

  // When both a college fragment and a parent university appear nearby in the
  // source, drop the college-only fragment for accreditation seeding.
  const lowerText = sourceText.toLowerCase();
  return kept.filter((name) => {
    if (!SUBUNIT.test(name) || PARENT_UNIVERSITY.test(name)) return true;
    const nearbyUniversity = kept.find(
      (other) =>
        other !== name &&
        PARENT_UNIVERSITY.test(other) &&
        lowerText.includes(other.toLowerCase()) &&
        lowerText.includes(name.toLowerCase()),
    );
    return !nearbyUniversity;
  });
}

export function institutionsFromText(text: string): string[] {
  const found = new Map<string, string>();
  const take = (raw: string) => {
    const name = normalizeInstitutionName(raw);
    if (!name) return;
    const key = name.toLowerCase();
    const existing = found.get(key);
    if (!existing || name.length > existing.length) found.set(key, name);
  };
  for (const match of text.matchAll(INSTITUTION_OF)) take(match[0]);
  for (const match of text.matchAll(INSTITUTION_NAMED)) take(match[0]);
  return preferParentInstitutions([...found.values()], text);
}

/** Two-letter states mentioned as license jurisdictions in already-read text. */
export function licenseStatesFromText(text: string): string[] {
  const found: string[] = [];
  const add = (value: string | null) => {
    if (value && !found.includes(value)) found.push(value);
  };
  for (const match of text.matchAll(
    /\b(?:licensed in|license(?:d)? in|licensure in)\s+([A-Za-z][A-Za-z .]{1,24}?)(?:,|\.|;| and |\n|$)/gi,
  )) {
    add(stateCode(match[1].trim()));
  }
  for (const match of text.matchAll(
    /\b([A-Z]{2})\s+(?:psychology |medical )?license(?:\s+number|\s+no\.?|:)?\b/g,
  )) {
    add(stateCode(match[1]));
  }
  return found.slice(0, 6);
}

export function extractResearchLeads(texts: readonly string[]): ResearchLeads {
  const blob = texts.filter(Boolean).join('\n');
  const programs: string[] = [];
  for (const program of PROGRAMS) {
    if (program.pattern.test(blob) && !programs.includes(program.key)) {
      programs.push(program.key);
    }
  }
  const funders: string[] = [];
  for (const funder of FUNDERS) {
    if (funder.pattern.test(blob) && !funders.includes(funder.key)) {
      funders.push(funder.key);
    }
  }
  const institutions: string[] = [];
  for (const name of institutionsFromText(blob)) {
    if (!institutions.includes(name)) institutions.push(name);
  }
  return {
    programs: programs.slice(0, 6),
    funders: funders.slice(0, 6),
    institutions: institutions.slice(0, 6),
  };
}
