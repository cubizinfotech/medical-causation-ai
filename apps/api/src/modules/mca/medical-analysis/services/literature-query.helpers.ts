import type { LiteratureSearchRequest } from '@integrations/medical-literature';
import type { MedicalAnalysisRequest } from '../types';

const MAX_QUERIES = 3;
const MAX_TERMS = 3;

/**
 * Queries go to a public database, so only plain medical words survive:
 * no PubMed syntax, no years or other long numbers, no age phrases.
 */
export function sanitizeLiteratureText(value: string): string {
  return value
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        !/\d{3,}/.test(word) &&
        !/year|month|week|day/i.test(word) &&
        !/^(and|or|not)$/i.test(word),
    )
    .join(' ')
    .trim();
}

function cleanList(
  values: unknown,
  maxItems: number,
  wordRange: [number, number],
): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .filter((value): value is string => typeof value === 'string')
    .map(sanitizeLiteratureText)
    .filter((value) => {
      const words = value.split(' ').length;
      return words >= wordRange[0] && words <= wordRange[1];
    });
  return [...new Set(cleaned.map((v) => v.toLowerCase()))].slice(0, maxItems);
}

/**
 * Validates the search the analysis model suggested (the literatureSearch
 * field of its JSON). Returns null when it is missing or unusable.
 */
export function parseLiteratureSuggestion(
  value: unknown,
): LiteratureSearchRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const suggestion = value as Record<string, unknown>;
  const queries = cleanList(suggestion.queries, MAX_QUERIES, [2, 8]);
  if (queries.length === 0) return null;
  return {
    queries,
    exposureTerms: cleanList(suggestion.exposureTerms, MAX_TERMS, [1, 5]),
    outcomeTerms: cleanList(suggestion.outcomeTerms, MAX_TERMS, [1, 5]),
  };
}

const MECHANISMS: Array<[RegExp, string]> = [
  [
    /motor vehicle|\bcar\b|auto|collision|\bmvc\b|crash/i,
    'motor vehicle collision',
  ],
  [/fall|slip/i, 'fall injury'],
  [/work|occupational/i, 'occupational injury'],
  [/sport/i, 'sports injury'],
  [/assault/i, 'assault injury'],
];

function mechanismFor(injury?: string): string {
  const accidentType = injury?.split(':')[0] ?? '';
  return (
    MECHANISMS.find(([pattern]) => pattern.test(accidentType))?.[1] ?? 'trauma'
  );
}

/** Diagnosis "A (note); B, C" -> ["a", "b", "c"], without notes. */
function conditionsFrom(diagnosis?: string): string[] {
  const conditions = (diagnosis ?? '')
    .replace(/\([^)]*\)/g, ' ')
    // Spinal levels (C5-C6, L4-L5) are too specific for a literature search.
    .replace(/\b[CTLS]\d{1,2}(?:\s*-\s*[CTLS]?\d{1,2})?\b/gi, ' ')
    .split(/[;,\n]|\bwith\b/i)
    .map((part) => sanitizeLiteratureText(part).toLowerCase())
    .filter((part) => part.length >= 3 && part.split(' ').length <= 4);
  return [...new Set(conditions)].slice(0, MAX_TERMS);
}

/** Used when the AI is unavailable: simple queries from the diagnosis. */
export function buildFallbackLiteratureRequest(
  request: MedicalAnalysisRequest,
): LiteratureSearchRequest | null {
  const conditions = conditionsFrom(request.diagnosis);
  if (conditions.length === 0) return null;

  const mechanism = mechanismFor(request.injury);
  // The diagnosis does not say which condition is the injury and which is
  // the claimed result, so test both links with the accident as well.
  const queries =
    conditions.length >= 2
      ? [
          `${conditions[1]} after ${conditions[0]}`,
          `${conditions[0]} after ${mechanism}`,
          `${conditions[1]} after ${mechanism}`,
        ]
      : [`${conditions[0]} after ${mechanism}`, `${conditions[0]} trauma`];

  const outcomes = conditions.length >= 2 ? conditions.slice(1) : conditions;
  return {
    queries: [...new Set(queries)].slice(0, MAX_QUERIES),
    exposureTerms:
      conditions.length >= 2 ? [conditions[0], mechanism] : [mechanism],
    outcomeTerms: [...new Set([...outcomes, ...outcomes.map(headNoun)])]
      .filter(Boolean)
      .slice(0, MAX_TERMS) as string[],
  };
}

const GENERIC_NOUNS = new Set([
  'injury',
  'injuries',
  'disorder',
  'disease',
  'syndrome',
  'condition',
  'dysfunction',
  'impairment',
]);

/** "ischemic stroke" -> "stroke", so titles that just say "stroke" match. */
function headNoun(condition: string): string | undefined {
  const words = condition.split(' ');
  const last = words[words.length - 1];
  return words.length > 1 && last.length >= 5 && !GENERIC_NOUNS.has(last)
    ? last
    : undefined;
}
