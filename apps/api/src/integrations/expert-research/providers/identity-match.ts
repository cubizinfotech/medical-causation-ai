import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  IdentityMatch,
} from '../expert-research.types';
import { citiesMatch } from '../live/location';
import { namesCompatible, parsePersonName } from '../live/person-name';
import { specialtyMatches } from '../live/specialty-match';

export interface ExpertIdentityHints {
  name?: string;
  city?: string;
  specialty?: string;
  employer?: string;
  education?: string;
  licenseState?: string;
  /**
   * How a live source tied the record to the expert. "npi" means the record
   * was retrieved by the confirmed NPI; "source_match" means the adapter
   * matched it by name plus specialty or location.
   */
  verifiedBy?: 'npi' | 'source_match';
  /** The source could not tell several people apart. */
  ambiguous?: boolean;
}

/**
 * A shared name is not enough. City or specialty must also agree,
 * and any supplied city or specialty must not contradict the query.
 * Uncertain items stay separate and are not merged into the expert.
 */
export function assessIdentityMatch(
  query: ExpertResearchQuery,
  item: ExpertEvidenceItem,
): IdentityMatch {
  const hints = identityHints(item);
  if (!hints.name || !namesAgree(hints.name, query.expertName)) {
    return 'uncertain';
  }
  if (hints.ambiguous) return 'uncertain';
  // Live adapters set verifiedBy only after their own stricter checks.
  if (hints.verifiedBy === 'npi' || hints.verifiedBy === 'source_match') {
    return 'matched';
  }
  if (hints.city && !sameCity(hints.city, query.city)) return 'uncertain';
  if (hints.specialty && !sameSpecialty(hints.specialty, query.specialty)) {
    return 'uncertain';
  }
  if (!hints.city && !hints.specialty) return 'uncertain';
  return 'matched';
}

export function applyIdentityMatch(
  query: ExpertResearchQuery,
  items: ExpertEvidenceItem[],
): ExpertEvidenceItem[] {
  return items.map((item) => ({
    ...item,
    identityMatch: assessIdentityMatch(query, item),
  }));
}

/** "Dr. Jane A. Smith, MD" agrees with "Jane Smith"; "Joan Smith" does not. */
export function namesAgree(left: string, right: string): boolean {
  if (normalize(left) === normalize(right)) return true;
  const a = parsePersonName(left);
  const b = parsePersonName(right);
  return Boolean(a && b && namesCompatible(a, b));
}

function sameCity(left: string, right: string): boolean {
  return normalize(left) === normalize(right) || citiesMatch(left, right);
}

function sameSpecialty(left: string, right: string): boolean {
  return normalize(left) === normalize(right) || specialtyMatches(right, left);
}

function identityHints(item: ExpertEvidenceItem): ExpertIdentityHints {
  const identity = item.raw?.identity;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return {};
  }
  const record = identity as Record<string, unknown>;
  const verifiedBy = text(record.verifiedBy);
  return {
    name: text(record.name),
    city: text(record.city),
    specialty: text(record.specialty),
    employer: text(record.employer),
    education: text(record.education),
    licenseState: text(record.licenseState),
    verifiedBy:
      verifiedBy === 'npi' || verifiedBy === 'source_match'
        ? verifiedBy
        : undefined,
    ambiguous: record.ambiguous === true,
  };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}
