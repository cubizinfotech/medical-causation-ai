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

export interface FindingDraft {
  title: string;
  summary?: string | null;
  url?: string | null;
  sourceType: string;
  provider: string;
  publishedAt?: Date | null;
  restricted?: boolean;
  notes?: string | null;
}

export interface StorableFinding {
  title: string;
  summary: string | null;
  url: string | null;
  sourceType: string;
  provider: string;
  publishedAt: Date | null;
  restricted: boolean;
  notes: string | null;
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
 * Restricted sources keep metadata and a permitted URL only.
 * Summary text is dropped so licensed content is not stored.
 */
export function toStorableFinding(draft: FindingDraft): StorableFinding {
  const restricted = isRestrictedSource(draft.provider, draft.restricted);
  return {
    title: draft.title.trim(),
    summary: restricted ? null : draft.summary?.trim() || null,
    url: draft.url?.trim() || null,
    sourceType: draft.sourceType,
    provider: draft.provider.trim().toLowerCase(),
    publishedAt: draft.publishedAt ?? null,
    restricted,
    notes: restricted
      ? draft.notes?.trim() ||
        'Metadata only. Source license does not permit storing content.'
      : draft.notes?.trim() || null,
  };
}
