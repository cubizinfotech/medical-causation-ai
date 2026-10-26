/**
 * CourtListener opinions vs RECAP trial-court filings. An opinion is never
 * treated as a complete docket.
 */
export type CourtSearchKind = 'opinion' | 'recap_document';

export type CourtLegalDocumentType =
  | 'case'
  | 'expert_witness_case'
  | 'motion'
  | 'order'
  | 'pleading'
  | 'deposition'
  | 'testimony';

export type CourtDocumentClass =
  | 'opinion'
  | 'order'
  | 'motion'
  | 'pleading'
  | 'deposition'
  | 'testimony'
  | 'other';

const MOTION =
  /\b(motion|memorandum in support|memorandum of law|application to)\b/i;
const ORDER =
  /\b(order|opinion and order|minute order|report and recommendation|judgment|decree)\b/i;
const PLEADING =
  /\b(complaint|answer|petition|plea|amended complaint|cross-claim|counterclaim|pleading)\b/i;
const DEPOSITION = /\bdeposition\b/i;
const TESTIMONY =
  /\b(trial transcript|hearing transcript|testimony transcript|sworn testimony)\b/i;
const OPINION =
  /\b(opinion|memorandum opinion|published opinion|unpublished opinion)\b/i;

/**
 * Classifies a court document from its search type, title, and description.
 * Guessing is refused: unknown RECAP files stay "other".
 */
export function classifyCourtDocument(input: {
  searchKind: CourtSearchKind;
  title?: string;
  description?: string;
  documentNumber?: string;
  snippet?: string;
  court?: string;
}): CourtDocumentClass {
  const hay =
    `${input.description ?? ''} ${input.snippet ?? ''} ${input.documentNumber ?? ''} ${input.title ?? ''}`.trim();
  if (input.searchKind === 'opinion') return 'opinion';
  const lead = (input.description ?? '').trim();
  if (/^(withdrawn\s+)?motion\b/i.test(lead)) return 'motion';
  if (/^(minute\s+)?order\b|^ordered\b/i.test(lead)) return 'order';
  // Deposition/testimony only from the filing description, never a snippet
  // of a motion or order that merely mentions a deposition.
  if (DEPOSITION.test(lead)) return 'deposition';
  if (TESTIMONY.test(lead)) return 'testimony';
  if (MOTION.test(hay) && !ORDER.test(hay)) return 'motion';
  if (PLEADING.test(hay) && !ORDER.test(hay) && !MOTION.test(hay)) {
    return 'pleading';
  }
  if (ORDER.test(hay) && !OPINION.test(hay)) return 'order';
  if (OPINION.test(hay)) return 'opinion';
  return 'other';
}

/** Maps a classified filing onto the legal-matter document type. */
export function legalDocumentTypeFor(
  kind: CourtDocumentClass,
  challenge: boolean,
): CourtLegalDocumentType {
  switch (kind) {
    case 'order':
      return 'order';
    case 'motion':
      return 'motion';
    case 'pleading':
      return 'pleading';
    case 'deposition':
      return 'deposition';
    case 'testimony':
      return 'testimony';
    case 'opinion':
      return challenge ? 'expert_witness_case' : 'case';
    default:
      return challenge ? 'expert_witness_case' : 'case';
  }
}

export function courtLevelOf(
  court?: string,
): 'appellate' | 'trial' | 'unknown' {
  if (!court) return 'unknown';
  if (
    /\b(supreme|appellate|court of appeals|cir\.|circuit)\b/i.test(court) &&
    !/\bdistrict\b/i.test(court)
  ) {
    return 'appellate';
  }
  if (/\b(district|superior|county|trial|circuit court)\b/i.test(court)) {
    return 'trial';
  }
  return 'unknown';
}

export const DOCKET_COVERAGE_NOTE =
  'This is a public filing or published opinion. It is not evidence that a complete case docket was reviewed.';
