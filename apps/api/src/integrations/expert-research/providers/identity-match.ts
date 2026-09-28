import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  IdentityMatch,
} from '../expert-research.types';

export interface ExpertIdentityHints {
  name?: string;
  city?: string;
  specialty?: string;
  employer?: string;
  education?: string;
  licenseState?: string;
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
  const name = normalize(hints.name);
  if (!name || name !== normalize(query.expertName)) return 'uncertain';
  if (hints.city && normalize(hints.city) !== normalize(query.city)) {
    return 'uncertain';
  }
  if (
    hints.specialty &&
    normalize(hints.specialty) !== normalize(query.specialty)
  ) {
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

function identityHints(item: ExpertEvidenceItem): ExpertIdentityHints {
  const identity = item.raw?.identity;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return {};
  }
  const record = identity as Record<string, unknown>;
  return {
    name: text(record.name),
    city: text(record.city),
    specialty: text(record.specialty),
    employer: text(record.employer),
    education: text(record.education),
    licenseState: text(record.licenseState),
  };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}
