import {
  mapEvidenceCategory,
  type EwiEvidenceCategory,
} from './evidence-categories';

export const INVESTIGATION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type InvestigationLifecycleStatus =
  (typeof INVESTIGATION_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<
  InvestigationLifecycleStatus,
  readonly InvestigationLifecycleStatus[]
> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export class InvalidInvestigationTransitionError extends Error {
  constructor(
    readonly from: InvestigationLifecycleStatus,
    readonly to: InvestigationLifecycleStatus,
  ) {
    super(`Cannot move an investigation from ${from} to ${to}`);
    this.name = 'InvalidInvestigationTransitionError';
  }
}

export function assertInvestigationTransition(
  from: InvestigationLifecycleStatus,
  to: InvestigationLifecycleStatus,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidInvestigationTransitionError(from, to);
  }
}

/** Providers whose license does not permit storing article/PDF body text. */
export const RESTRICTED_SOURCE_PROVIDERS = ['lexisnexis', 'westlaw'] as const;

const METADATA_ONLY_NOTE =
  'Metadata only. Source license does not permit storing content. LexisNexis PDFs are not stored.';

/** Attribute keys that carry document or article body text. Never persisted. */
const STORED_CONTENT_KEYS = new Set([
  'fulltext',
  'body',
  'content',
  'pdf',
  'pdfbytes',
  'bytes',
  'opiniontext',
  'articletext',
  'file',
  'filebytes',
  'documentbody',
  'html',
  'transcript',
  'transcripttext',
]);

/** Permitted metadata for restricted sources. Bodies and PDFs stay out. */
const RESTRICTED_METADATA_ATTRIBUTE_KEYS = new Set([
  'documenttype',
  'casename',
  'casenumber',
  'court',
  'jurisdiction',
  'filingdate',
  'documentdate',
  'date',
  'relevance',
  'findingsregardingexpert',
  'evidencereference',
  'evidencereferences',
  'matterkind',
  'ordertags',
  'shortdescription',
  'transcriptmetadata',
  'importantstatements',
  'publishedat',
  'publicationdate',
  'metadataonly',
  'identity',
  'identitymatch',
  'presencekind',
  'platform',
  'pagetitle',
  'retrievedat',
  'relevantclaims',
  'advertisingclaims',
  'forensicclaims',
  'expertwitnessclaims',
  'treatmentpracticeinfo',
  'conflictorbiasindicators',
  'description',
  'transcriptavailable',
  'transcriptunavailablereason',
  'rating',
  'reviewdate',
  'reviewtextpermitted',
  'neutralsummary',
  'address',
  'businessname',
  'locationflags',
  'locationnote',
  'claimedstates',
  'claimedboard',
  'professionalkind',
  'name',
  'title',
  'identifier',
  'grantid',
  'patentnumber',
  'trademarknumber',
  'filingdate',
  'startdate',
  'enddate',
  'dates',
  'status',
  'role',
  'participation',
  'authorship',
  'institution',
  'organization',
  'source',
  'resulturl',
  'resultsavailable',
  'resultsunavailablereason',
  'cvclaim',
  'publicrecord',
  'paymentdate',
  'paymentamount',
  'payer',
  'natureofpayment',
  'forensicwork',
  'defensework',
  'hourlyrate',
  'referralinfo',
  'percentforensicwork',
  'percentdefensework',
  'verificationnote',
]);

export type StoredEvidenceStatus = 'recorded' | 'metadata_only' | 'unavailable';

export interface FindingDraft {
  title: string;
  summary?: string | null;
  url?: string | null;
  sourceType: string;
  sourceName?: string | null;
  provider: string;
  publishedAt?: Date | null;
  retrievedAt?: Date | null;
  relevantDates?: Date[] | null;
  restricted?: boolean;
  notes?: string | null;
  attributes?: Record<string, unknown> | null;
  identityMatch?: 'matched' | 'uncertain';
}

export interface StorableFinding {
  title: string;
  summary: string | null;
  url: string | null;
  sourceType: string;
  sourceName: string;
  category: EwiEvidenceCategory;
  provider: string;
  publishedAt: Date | null;
  retrievedAt: Date | null;
  relevantDates: Date[];
  evidenceStatus: StoredEvidenceStatus;
  restricted: boolean;
  notes: string | null;
  attributes: Record<string, unknown> | null;
  identityMatch: 'matched' | 'uncertain';
}

export function isRestrictedSource(
  provider: string,
  restricted?: boolean,
): boolean {
  if (restricted) return true;
  return RESTRICTED_SOURCE_PROVIDERS.includes(
    provider
      .trim()
      .toLowerCase() as (typeof RESTRICTED_SOURCE_PROVIDERS)[number],
  );
}

/**
 * Restricted sources keep a title, source metadata, and a permitted URL.
 * Summary text, document bodies, and LexisNexis PDF content are not stored.
 */
export function toStorableFinding(draft: FindingDraft): StorableFinding {
  const restricted = isRestrictedSource(draft.provider, draft.restricted);
  const publishedAt = draft.publishedAt ?? null;
  const relevantDates = (draft.relevantDates ?? []).filter(
    (value) => value instanceof Date && !Number.isNaN(value.getTime()),
  );
  if (
    publishedAt &&
    !relevantDates.some((value) => value.getTime() === publishedAt.getTime())
  ) {
    relevantDates.push(publishedAt);
  }

  const identityMatch =
    draft.identityMatch === 'matched' ? 'matched' : 'uncertain';
  const uncertainNote =
    draft.identityMatch === 'uncertain'
      ? 'Identity was not established. This record was not merged with the expert.'
      : '';

  return {
    title: draft.title.trim(),
    summary: restricted ? null : draft.summary?.trim() || null,
    url: safeSourceUrl(draft.url),
    sourceType: draft.sourceType,
    sourceName: draft.sourceName?.trim() || draft.provider.trim(),
    category: mapEvidenceCategory(draft.sourceType),
    provider: draft.provider.trim().toLowerCase(),
    publishedAt,
    retrievedAt: draft.retrievedAt ?? null,
    relevantDates,
    evidenceStatus: restricted ? 'metadata_only' : 'recorded',
    restricted,
    notes: restricted
      ? draft.notes?.trim() || METADATA_ONLY_NOTE
      : [
          draft.notes?.trim(),
          identityMatch === 'uncertain' ? uncertainNote : '',
        ]
          .filter(Boolean)
          .join(' ') || null,
    attributes: withIdentity(
      storableAttributes(draft.attributes, restricted),
      draft.identityMatch,
      restricted,
    ),
    identityMatch,
  };
}

function withIdentity(
  attributes: Record<string, unknown> | null,
  identityMatch: 'matched' | 'uncertain' | undefined,
  restricted: boolean,
): Record<string, unknown> | null {
  if (!identityMatch) return attributes;
  if (restricted) {
    return {
      ...(attributes ?? {}),
      identityMatch,
    };
  }
  return { ...(attributes ?? {}), identityMatch };
}

function safeSourceUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || null;
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('data:')) return null;
  return trimmed;
}

function storableAttributes(
  value: Record<string, unknown> | null | undefined,
  restricted: boolean,
): Record<string, unknown> | null {
  if (!value) return null;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (STORED_CONTENT_KEYS.has(lower)) continue;
    if (typeof entry === 'string' && entry.toLowerCase().startsWith('data:')) {
      continue;
    }
    if (restricted && !RESTRICTED_METADATA_ATTRIBUTE_KEYS.has(lower)) continue;
    next[key] = entry;
  }
  return Object.keys(next).length > 0 ? next : null;
}
