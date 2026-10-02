import type {
  ExpertResearchProviderId,
  ExpertResearchQuery,
  ExpertResearchSourceResult,
} from '../expert-research.types';
import { assessIdentityMatch } from './identity-match';

/**
 * Sources checked for a public record or affiliation.
 * criminal_records already exists. The others are public-page checks only.
 */
export const PUBLIC_EVIDENCE_PROVIDER_IDS = [
  'criminal_records',
  'constitutional_sheriff',
  'post_records',
  'oath_keepers',
] as const satisfies readonly ExpertResearchProviderId[];

export const NO_VERIFIED_PUBLIC_EVIDENCE = 'No verified public evidence found.';

/** Signals that must not be treated as membership or a criminal record. */
const WEAK_AFFILIATION_FLAGS = [
  'similarName',
  'eventAttendanceOnly',
  'generalArticle',
  'lawEnforcementEmployment',
  'politicalOpinion',
] as const;

const PUBLIC_EVIDENCE_PROVIDER_SET = new Set<string>(
  PUBLIC_EVIDENCE_PROVIDER_IDS,
);

export function isPublicEvidenceProvider(sourceId: string): boolean {
  return PUBLIC_EVIDENCE_PROVIDER_SET.has(sourceId);
}

/**
 * A finding is recordable only when the identity matches and a public source
 * states the record or affiliation. Weak signals are never enough.
 */
export function canRecordPublicEvidence(
  query: ExpertResearchQuery,
  item: ExpertResearchSourceResult['items'][number],
): boolean {
  if (assessIdentityMatch(query, item) !== 'matched') return false;
  if (!item.url?.trim()) return false;
  const raw = item.raw ?? {};
  if (WEAK_AFFILIATION_FLAGS.some((flag) => raw[flag] === true)) return false;
  const statement = raw.publicSourceStatement;
  if (typeof statement !== 'string' || statement.trim().length === 0) {
    return false;
  }
  if (item.sourceId === 'post_records') {
    const jurisdiction = raw.jurisdiction;
    if (typeof jurisdiction !== 'string' || jurisdiction.trim().length === 0) {
      return false;
    }
  }
  return true;
}

export function publicEvidenceMessage(sourceId: string): string {
  const base = `${NO_VERIFIED_PUBLIC_EVIDENCE} No record or affiliation was inferred.`;
  if (sourceId === 'criminal_records') {
    return `${base} No criminal-record source was retrieved.`;
  }
  if (sourceId === 'constitutional_sheriff') {
    return `${base} No public source stated a Constitutional Sheriff affiliation.`;
  }
  if (sourceId === 'post_records') {
    return `${base} Peace Officer Standards and Training agencies differ by state. No state agency was selected from the city, and no POST website was requested.`;
  }
  if (sourceId === 'oath_keepers') {
    return `${base} No public source stated an Oath Keepers affiliation.`;
  }
  return base;
}

/**
 * Drops unsupported items. An empty check keeps the source status and the
 * no-evidence sentence. Source URL and statement stay on items that qualify.
 */
export function applyPublicEvidenceGate(
  query: ExpertResearchQuery,
  result: ExpertResearchSourceResult,
): ExpertResearchSourceResult {
  if (!isPublicEvidenceProvider(result.sourceId)) return result;
  const items = result.items.filter((item) =>
    canRecordPublicEvidence(query, item),
  );
  if (items.length === 0) {
    const searched = result.status === 'ok' || result.status === 'no_result';
    return {
      ...result,
      status: searched ? 'no_result' : result.status,
      outcome: searched ? 'no_result' : result.outcome,
      items: [],
      message: publicEvidenceMessage(result.sourceId),
    };
  }
  return {
    ...result,
    status: 'ok',
    items,
  };
}
