/**
 * Words too general to tell specialties apart. "Internal Medicine" still
 * matches on "internal"; "Medicine" alone never decides a match.
 */
const GENERIC_WORDS = new Set([
  'medicine',
  'medical',
  'surgery',
  'surgical',
  'surgeon',
  'surgeons',
  'general',
  'practice',
  'specialist',
  'specialty',
  'physician',
  'physicians',
  'doctor',
  'and',
  'the',
  'of',
  'care',
  'clinic',
  'clinical',
  'health',
  'allopathic',
  'osteopathic',
  'board',
  'certified',
  'certification',
  'licensed',
  'expert',
  'witness',
  'consultant',
  'attending',
  'professor',
  'associate',
  'assistant',
  'chief',
  'director',
  'senior',
  'staff',
]);

/**
 * Phrases rewritten before splitting into words, so different names for one
 * field compare equal and look-alike names stay apart ("neurological surgery"
 * is neurosurgery, not neurology).
 */
const PHRASES: Array<[RegExp, string]> = [
  [/\bneurological\s+surg\w*/g, 'neurosurg'],
  [/\bneuro\s*surg\w*/g, 'neurosurg'],
  [/\bcardiovascular\s+disease\b/g, 'cardiology'],
  [/\bcardiovascular\b/g, 'cardiology'],
  [/\bpain\s+(?:management|medicine)\b/g, 'painmedicine'],
  [/\bob\s*\/?\s*gyn\b/g, 'obgyn'],
  [/\bobstetrics?\s*(?:&|and)?\s*gynecology\b/g, 'obgyn'],
  [/\bobstetric\w*/g, 'obgyn'],
  [/\bgynecolog\w*/g, 'obgyn'],
  [/\bear,?\s+nose,?\s+(?:&|and)?\s*throat\b/g, 'otolaryngology'],
  [/\bent\b/g, 'otolaryngology'],
  [/\bphysical\s+medicine\s*(?:&|and)?\s*rehabilitation\b/g, 'physiatry'],
  [/\bpm\s*&\s*r\b/g, 'physiatry'],
  [/\bpulmonary\s+disease\b/g, 'pulmonology'],
  [/\bpulmonary\b/g, 'pulmonology'],
];

/** Spelling variants reduced to one stem. */
const VARIANTS: Array<[RegExp, string]> = [
  [/orthopaed/g, 'orthoped'],
  [/anaesthe/g, 'anesthe'],
  [/paediatr/g, 'pediatr'],
  [/haemat/g, 'hemat'],
  [/gynaecol/g, 'gynecol'],
  [/oesophag/g, 'esophag'],
];

function stem(word: string): string {
  let value = word;
  for (const [pattern, replacement] of VARIANTS) {
    value = value.replace(pattern, replacement);
  }
  // neurologist / neurology / neurological -> neurolog
  return value.replace(/(ists?|ics?|ical|y|ies)$/, '');
}

export function specialtyStems(value: string): string[] {
  let text = value.toLowerCase();
  for (const [pattern, replacement] of VARIANTS) {
    text = text.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of PHRASES) {
    text = text.replace(pattern, replacement);
  }
  return [
    ...new Set(
      text
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !GENERIC_WORDS.has(word))
        .map(stem)
        .filter((word) => word.length > 3),
    ),
  ];
}

function sameStem(left: string, right: string): boolean {
  return left.startsWith(right) || right.startsWith(left);
}

/**
 * The described specialty fits the claimed one: every distinctive word of the
 * shorter description appears in the longer one ("Neurology" fits
 * "Psychiatry & Neurology, Neurology"; "Neurology" does not fit "Psychiatry").
 */
export function specialtyMatches(claimed: string, described: string): boolean {
  const a = specialtyStems(claimed);
  const b = specialtyStems(described);
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((word) => longer.some((other) => sameStem(word, other)));
}

/**
 * Looser test for research topics: at least one distinctive word is shared
 * ("Physical Medicine and Rehabilitation" overlaps "Stroke Rehabilitation").
 */
export function specialtyOverlaps(claimed: string, described: string): boolean {
  const a = specialtyStems(claimed);
  const b = specialtyStems(described);
  return a.some((word) => b.some((other) => sameStem(word, other)));
}

/**
 * The parts of an NPPES taxonomy worth comparing. "Psychiatry & Neurology,
 * Neurology" compares on "Neurology" only, so a neurologist is not matched to
 * "Psychiatry". A single-board classification such as "Internal Medicine"
 * still counts for its subspecialists.
 */
export function taxonomyComparisons(description: string): string[] {
  const parts = description
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1) return parts;
  const classification = parts[0];
  const specialization = parts[parts.length - 1];
  return classification.includes('&')
    ? [specialization]
    : [specialization, classification];
}

export function taxonomyMatches(claimed: string, description: string): boolean {
  return taxonomyComparisons(description).some((part) =>
    specialtyMatches(claimed, part),
  );
}

/** Stems from PHRASES that are not words a court opinion would contain. */
const SEARCH_EXPANSIONS: Record<string, string[]> = {
  painmedicine: ['"pain management"', '"pain medicine"'],
  obgyn: ['obstetric*', 'gynecolog*'],
  physiatr: ['physiatr*', '"physical medicine"'],
  pulmonolog: ['pulmonolog*', 'pulmonary'],
};

/**
 * Terms for a full-text search that should mention the specialty, e.g.
 * "Neurology" -> ["neurolog*"]. Any one term is enough. Empty when only
 * generic words are left.
 */
export function specialtySearchTerms(specialty: string): string[] {
  return [
    ...new Set(
      specialtyStems(specialty).flatMap(
        (word) => SEARCH_EXPANSIONS[word] ?? [`${word}*`],
      ),
    ),
  ];
}
