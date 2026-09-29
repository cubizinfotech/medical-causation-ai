import {
  EXPERT_RESEARCH_CATALOG,
  type ExpertResearchProviderId,
  type ExpertResearchSourceResult,
  type ProviderRequirement,
  type ResearchOutcome,
  type SourceAccessClass,
} from '@integrations/expert-research';

/** Per-provider attempt state shown in progress and audit. */
export type ProviderAttemptStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'unavailable'
  | 'restricted';

/**
 * How the research should be interpreted.
 * completed — source was checked and returned usable or empty results
 * unavailable — attempted but source could not be used
 * not_applicable — skipped as not relevant / already collected
 * paid_access — requires paid or subscription access
 * manual_action — requires manual / authorized human action
 */
export type ResearchDisposition =
  | 'completed'
  | 'unavailable'
  | 'not_applicable'
  | 'paid_access'
  | 'manual_action';

export interface ProviderAttemptRecord {
  sourceId: string;
  attemptStatus: ProviderAttemptStatus;
  disposition: ResearchDisposition;
  outcome?: ResearchOutcome;
  access?: SourceAccessClass;
  message?: string;
  itemCount: number;
  /** True only when the provider was actually consulted. */
  checked: boolean;
}

const CATALOG_BY_ID = new Map(
  EXPERT_RESEARCH_CATALOG.map((entry) => [entry.id, entry]),
);

export function requirementFor(
  sourceId: string,
): ProviderRequirement | undefined {
  return CATALOG_BY_ID.get(sourceId as ExpertResearchProviderId)?.requirement;
}

/**
 * Maps a provider result to attempt status and disposition.
 * Never marks completed when the provider was not checked.
 */
export function mapProviderAttempt(
  result: ExpertResearchSourceResult,
  options?: { skipped?: boolean; checked?: boolean },
): ProviderAttemptRecord {
  if (options?.skipped) {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'skipped',
      disposition: 'not_applicable',
      outcome: result.outcome,
      access: result.access,
      message:
        result.message ?? 'Skipped. Already collected in this investigation.',
      itemCount: 0,
      checked: false,
    };
  }

  const checked = options?.checked ?? true;
  const requirement = requirementFor(result.sourceId);
  const restricted =
    result.access === 'restricted' ||
    result.outcome === 'restricted' ||
    result.outcome === 'authentication_required';

  if (!checked) {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'queued',
      disposition: dispositionForUnchecked(requirement, restricted),
      outcome: result.outcome,
      access: result.access,
      message: result.message ?? 'Not checked yet.',
      itemCount: 0,
      checked: false,
    };
  }

  if (restricted) {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'restricted',
      disposition:
        requirement === 'manual' || requirement === 'user_credentials'
          ? 'manual_action'
          : 'paid_access',
      outcome: result.outcome,
      access: result.access,
      message: result.message,
      itemCount: result.items.length,
      checked: true,
    };
  }

  if (result.status === 'unavailable' || result.outcome === 'unavailable') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'unavailable',
      disposition: dispositionForUnavailable(requirement),
      outcome: result.outcome,
      access: result.access,
      message: result.message,
      itemCount: 0,
      checked: true,
    };
  }

  if (result.status === 'error') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'failed',
      disposition: 'unavailable',
      outcome: result.outcome,
      access: result.access,
      message: result.message,
      itemCount: 0,
      checked: true,
    };
  }

  // ok or no_result — source was consulted
  return {
    sourceId: result.sourceId,
    attemptStatus: 'completed',
    disposition: 'completed',
    outcome: result.outcome,
    access: result.access,
    message: result.message,
    itemCount: result.items.length,
    checked: true,
  };
}

function dispositionForUnchecked(
  requirement: ProviderRequirement | undefined,
  restricted: boolean,
): ResearchDisposition {
  if (restricted) return 'paid_access';
  if (requirement === 'manual' || requirement === 'user_credentials') {
    return 'manual_action';
  }
  if (
    requirement === 'paid_api' ||
    requirement === 'subscription' ||
    requirement === 'account'
  ) {
    return 'paid_access';
  }
  return 'unavailable';
}

function dispositionForUnavailable(
  requirement: ProviderRequirement | undefined,
): ResearchDisposition {
  if (requirement === 'manual' || requirement === 'user_credentials') {
    return 'manual_action';
  }
  if (
    requirement === 'paid_api' ||
    requirement === 'subscription' ||
    requirement === 'account'
  ) {
    return 'paid_access';
  }
  return 'unavailable';
}

export function exponentialBackoffMs(
  baseDelayMs: number,
  attempt: number,
): number {
  const safeBase = Math.max(0, baseDelayMs);
  const safeAttempt = Math.max(1, attempt);
  return safeBase * 2 ** (safeAttempt - 1);
}
