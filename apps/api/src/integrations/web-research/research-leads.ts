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

const INSTITUTION_OF =
  /\b(?:University|College|Institute|School) of [A-Z][A-Za-z&-]+(?: (?:at |of )?[A-Z][A-Za-z&-]+){0,3}\b/g;
const INSTITUTION_NAMED =
  /\b(?:[A-Z][A-Za-z&-]+ ){1,3}(?:University|College)\b/g;
const NOT_PART_OF_NAME =
  /^(?:He|She|They|Dr|Mr|Ms|The|Her|His|In|At|And|From|With|After|Before)\s+/;

const GENERIC_SCHOOLS = new Set([
  'the university',
  'a university',
  'this university',
  'college of',
]);

export function institutionsFromText(text: string): string[] {
  const found = new Map<string, string>();
  const take = (raw: string) => {
    let name = raw.replace(/\s+/g, ' ').trim();
    while (NOT_PART_OF_NAME.test(name))
      name = name.replace(NOT_PART_OF_NAME, '');
    if (!/(University|College|Institute|School)/.test(name)) return;
    const key = name.toLowerCase();
    if (GENERIC_SCHOOLS.has(key)) return;
    if (!found.has(key)) found.set(key, name);
  };
  for (const match of text.matchAll(INSTITUTION_OF)) take(match[0]);
  for (const match of text.matchAll(INSTITUTION_NAMED)) take(match[0]);
  return [...found.values()];
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
