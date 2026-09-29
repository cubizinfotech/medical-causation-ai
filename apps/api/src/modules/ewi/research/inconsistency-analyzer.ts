import type { ExpertEvidenceItem } from '@integrations/expert-research';
import { extractClaims, type ExtractedClaim } from './claim-extractor';
import {
  CONFIRMING_PROVIDERS,
  FIELD_LABEL,
  INCONSISTENCY_LABEL_TEXT,
  isLapsedStatus,
  priorityFor,
  sameCollectedValue,
  severityFor,
  type InconsistencyLabel,
  type VerificationField,
} from './verification-labels';

export interface VerificationAttempt {
  providerId: string;
  status: string;
  outcome?: string;
  access?: string;
  itemCount: number;
}

export interface InconsistencySource {
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  retrievedAt?: string;
  value: string;
  cvDate?: string;
}

export interface Inconsistency {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  evidenceIds: string[];
  relatedUrls: string[];
  label: InconsistencyLabel;
  field: VerificationField;
  previousValue: string | null;
  currentValue: string | null;
  change: string | null;
  cvDate: string | null;
  cvSource: string | null;
  supportingSource: string | null;
  priority: number;
  sources: InconsistencySource[];
}

/**
 * Compares collected statements. Labels describe the evidence.
 * A missing or unavailable source does not establish what the claim should say.
 */
export function analyzeInconsistencies(
  items: ExpertEvidenceItem[],
  attempts: readonly VerificationAttempt[] = [],
): Inconsistency[] {
  const rows: Inconsistency[] = [];
  const countGap = publicationCountGap(items);
  if (countGap) rows.push(countGap);

  const groups = new Map<string, ExtractedClaim[]>();
  for (const claim of extractClaims(items)) {
    const key = `${claim.field}::${claim.subject.trim().toLowerCase()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(claim);
    groups.set(key, bucket);
  }

  for (const [key, claims] of groups) {
    const row = compareGroup(key, claims, attempts);
    if (row) rows.push(row);
  }

  return rows.sort(
    (left, right) =>
      left.priority - right.priority || left.id.localeCompare(right.id),
  );
}

function compareGroup(
  key: string,
  claims: ExtractedClaim[],
  attempts: readonly VerificationAttempt[],
): Inconsistency | null {
  const positive = claims.filter((claim) => claim.lookup === 'stated');
  const missing = claims.filter((claim) => claim.lookup === 'not_found');
  const distinct = distinctValues(positive);
  const field = claims[0].field;

  if (distinct.length >= 2) {
    return conflictRow(key, field, positive);
  }

  if (missing.length > 0 && positive.length > 0) {
    return statusRow(key, field, 'not_found', positive, missing);
  }

  if (distinct.length === 0) return null;

  const value = distinct[0];
  const records = positive.filter((claim) => claim.role === 'record');
  const statedClaims = positive.filter((claim) => claim.role === 'claim');

  if (
    field === 'license_status' &&
    isLapsedStatus(value) &&
    statedClaims.length === 0 &&
    records.length > 0
  ) {
    return lapsedRow(key, records);
  }

  if (statedClaims.length === 0) return null;
  if (
    records.some((record) => sameCollectedValue(field, record.value, value))
  ) {
    return null;
  }

  const label = labelForUnconfirmed(field, attempts);
  return statusRow(key, field, label, statedClaims, records);
}

function conflictRow(
  key: string,
  field: VerificationField,
  claims: ExtractedClaim[],
): Inconsistency {
  const versions = claims
    .filter((claim) => claim.cvDate)
    .slice()
    .sort((left, right) =>
      (left.cvDate ?? '').localeCompare(right.cvDate ?? ''),
    );
  const distinctVersions = collapseSameValues(field, versions);
  const chronological = distinctVersions.length >= 2;
  const earlier = chronological ? distinctVersions[0] : claims[0];
  const later = chronological
    ? distinctVersions[distinctVersions.length - 1]
    : (claims.find(
        (claim) => !sameCollectedValue(field, claim.value, earlier.value),
      ) ?? claims[claims.length - 1]);
  const support = claims.find(
    (claim) => claim !== earlier && claim !== later && claim.role === 'record',
  );

  const label: InconsistencyLabel = 'conflicting';
  const severity = severityFor(field, label);
  const name = FIELD_LABEL[field];
  const change = chronological
    ? `${name} differs between CV versions.`
    : `${name} differs across collected sources.`;
  const description = chronological
    ? `${later.cvSource ?? later.sourceName} (${later.cvDate}) states ${later.value}. ${earlier.cvSource ?? earlier.sourceName} (${earlier.cvDate}) states ${earlier.value}. ${support ? `${support.sourceName} states ${support.value}. ` : ''}The collected statements conflict. The comparison keeps both values.`
    : `${later.sourceName} states ${later.value}. ${earlier.sourceName} states ${earlier.value}. The collected statements conflict. The comparison keeps both values.`;

  return finish(key, {
    field,
    label,
    severity,
    title: `${name} differs across collected sources`,
    description,
    change,
    previousValue: earlier.value,
    currentValue: later.value,
    cvDate: chronological ? later.cvDate : earlier.cvDate,
    cvSource: chronological
      ? (later.cvSource ?? later.sourceName)
      : earlier.cvSource,
    supportingSource: support?.sourceName ?? earlier.sourceName,
    claims,
  });
}

function lapsedRow(key: string, records: ExtractedClaim[]): Inconsistency {
  const record = records[0];
  const label: InconsistencyLabel = records.every(
    (entry) => entry.informationStatus === 'verified',
  )
    ? 'verified'
    : 'not_verified';
  const severity = severityFor('license_status', label);
  return finish(key, {
    field: 'license_status',
    label,
    severity,
    title: 'License status is recorded as lapsed',
    description: `${record.sourceName} states the license status as ${record.value}. This repeats that collected statement. No contrary status was collected.`,
    change: `Status is recorded as ${record.value}.`,
    previousValue: null,
    currentValue: record.value,
    cvDate: record.cvDate,
    cvSource: record.cvSource,
    supportingSource: record.sourceName,
    claims: records,
  });
}

function statusRow(
  key: string,
  field: VerificationField,
  label: InconsistencyLabel,
  primary: ExtractedClaim[],
  extra: ExtractedClaim[],
): Inconsistency {
  const claim = primary[0];
  const name = FIELD_LABEL[field];
  const severity = severityFor(field, label);
  const consulted = extra[0]?.sourceName;
  const change =
    label === 'not_found'
      ? 'A consulted source did not find this claim.'
      : label === 'unable_to_verify'
        ? 'A confirming source was unavailable.'
        : label === 'partially_verified'
          ? 'Only part of the collected statement was confirmed.'
          : 'A consulted source did not confirm this claim.';
  const description =
    label === 'not_found'
      ? `${claim.sourceName} states ${claim.value}. ${consulted ? `${consulted} reported that it was not found. ` : 'A consulted source reported no matching record. '}The label records that search result.`
      : label === 'unable_to_verify'
        ? `${claim.sourceName} states ${claim.value}. A confirming source was unavailable or restricted, so the statement could not be verified. Nothing was inferred.`
        : `${claim.sourceName} states ${claim.value}. ${consulted ? `${consulted} did not confirm that statement. ` : 'No consulted source confirmed that statement. '}The claim remains ${INCONSISTENCY_LABEL_TEXT[label].toLowerCase()}.`;

  return finish(key, {
    field,
    label,
    severity,
    title:
      label === 'not_found'
        ? `${name} was not found in a consulted source`
        : label === 'unable_to_verify'
          ? `${name} could not be verified`
          : `${name} was not confirmed`,
    description,
    change,
    previousValue: null,
    currentValue: claim.value,
    cvDate: claim.cvDate,
    cvSource: claim.cvSource,
    supportingSource: consulted ?? null,
    claims: [...primary, ...extra],
  });
}

function publicationCountGap(
  items: ExpertEvidenceItem[],
): Inconsistency | null {
  const item = items.find(
    (entry) =>
      entry.identityMatch !== 'uncertain' &&
      typeof entry.raw?.cvCount === 'number' &&
      typeof entry.raw?.indexedCount === 'number',
  );
  if (!item || !item.raw) return null;
  const cvCount = item.raw.cvCount as number;
  const indexedCount = item.raw.indexedCount as number;
  if (cvCount === indexedCount) return null;
  const label: InconsistencyLabel =
    indexedCount > 0 && indexedCount < cvCount
      ? 'partially_verified'
      : 'not_verified';
  const severity = severityFor('publication', label);
  const sourceName = item.source?.name ?? item.sourceId;
  return {
    id: 'publication-count-gap',
    severity,
    title: 'Publication count differs across collected statements',
    description: `${sourceName} lists ${cvCount} publications and ${indexedCount} indexed matches. The difference was not confirmed. It is not proof that the remaining publications are absent.`,
    evidenceIds: [item.title],
    relatedUrls: item.url ? [item.url] : [],
    label,
    field: 'publication',
    previousValue: String(indexedCount),
    currentValue: String(cvCount),
    change:
      'Publication counts differ. The difference is not proof that the remaining items are absent.',
    cvDate: null,
    cvSource: null,
    supportingSource: sourceName,
    priority: priorityFor(severity, label),
    sources: [
      {
        sourceId: item.sourceId,
        sourceName,
        title: item.title,
        url: item.url,
        retrievedAt: item.retrievedAt,
        value: `CV count ${cvCount}; indexed count ${indexedCount}`,
      },
    ],
  };
}

function labelForUnconfirmed(
  field: VerificationField,
  attempts: readonly VerificationAttempt[],
): InconsistencyLabel {
  const relevant = attempts.filter((attempt) =>
    CONFIRMING_PROVIDERS[field].includes(attempt.providerId),
  );
  if (relevant.length === 0) {
    return attempts.length > 0 ? 'unable_to_verify' : 'not_verified';
  }
  const returned = relevant.some(
    (attempt) =>
      attempt.itemCount > 0 &&
      attempt.status !== 'unavailable' &&
      attempt.outcome !== 'unavailable' &&
      attempt.outcome !== 'no_result' &&
      attempt.status !== 'no_result',
  );
  if (returned) return 'not_verified';
  const answeredEmpty = relevant.some(
    (attempt) =>
      attempt.status === 'no_result' || attempt.outcome === 'no_result',
  );
  if (answeredEmpty) return 'not_found';
  return 'unable_to_verify';
}

function distinctValues(claims: ExtractedClaim[]): string[] {
  const values: string[] = [];
  for (const claim of claims) {
    if (
      values.some((value) =>
        sameCollectedValue(claim.field, value, claim.value),
      )
    ) {
      continue;
    }
    values.push(claim.value);
  }
  return values;
}

function collapseSameValues(
  field: VerificationField,
  claims: ExtractedClaim[],
): ExtractedClaim[] {
  const kept: ExtractedClaim[] = [];
  for (const claim of claims) {
    const previous = kept[kept.length - 1];
    if (previous && sameCollectedValue(field, previous.value, claim.value)) {
      continue;
    }
    kept.push(claim);
  }
  return kept;
}

function finish(
  key: string,
  input: {
    field: VerificationField;
    label: InconsistencyLabel;
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    change: string;
    previousValue: string | null;
    currentValue: string | null;
    cvDate: string | null;
    cvSource: string | null;
    supportingSource: string | null;
    claims: ExtractedClaim[];
  },
): Inconsistency {
  const sources = input.claims.map(toSource);
  return {
    id: key,
    severity: input.severity,
    title: input.title,
    description: input.description,
    evidenceIds: [...new Set(input.claims.map((claim) => claim.title))],
    relatedUrls: [
      ...new Set(
        input.claims
          .map((claim) => claim.url)
          .filter((url): url is string => Boolean(url)),
      ),
    ],
    label: input.label,
    field: input.field,
    previousValue: input.previousValue,
    currentValue: input.currentValue,
    change: input.change,
    cvDate: input.cvDate,
    cvSource: input.cvSource,
    supportingSource: input.supportingSource,
    priority: priorityFor(input.severity, input.label),
    sources,
  };
}

function toSource(claim: ExtractedClaim): InconsistencySource {
  return {
    sourceId: claim.sourceId,
    sourceName: claim.sourceName,
    title: claim.title,
    url: claim.url,
    retrievedAt: claim.retrievedAt,
    value: claim.value,
    cvDate: claim.cvDate ?? undefined,
  };
}
