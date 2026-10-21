import {
  EXPERT_RESEARCH_CATALOG,
  coverageWasAttempted,
  researchCoverageFor,
  type ExpertResearchProviderId,
  type ExpertResearchSourceResult,
  type ProviderRequirement,
  type ResearchCoverage,
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
  coverage: ResearchCoverage;
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
  const coverage = researchCoverageFor({
    status: result.status,
    outcome: result.outcome,
    message: result.message,
    itemCount: result.items.length,
    access: result.access,
    skipped: options?.skipped,
  });
  const requirement = requirementFor(result.sourceId);

  if (options?.skipped || coverage === 'skipped') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'skipped',
      disposition: 'not_applicable',
      outcome: result.outcome,
      coverage: 'skipped',
      access: result.access,
      message:
        result.message ?? 'Skipped. Already collected in this investigation.',
      itemCount: 0,
      checked: false,
    };
  }

  if (options?.checked === false || coverage === 'pending') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'queued',
      disposition: dispositionForUnchecked(
        requirement,
        coverage === 'blocked_or_access_denied',
      ),
      outcome: result.outcome,
      coverage: coverage === 'pending' ? 'pending' : coverage,
      access: result.access,
      message: result.message ?? 'Not checked yet.',
      itemCount: 0,
      checked: false,
    };
  }

  if (coverage === 'not_implemented' || coverage === 'not_configured') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'unavailable',
      disposition:
        coverage === 'not_configured'
          ? dispositionForUnavailable(requirement)
          : dispositionForUnchecked(requirement, false),
      outcome: result.outcome,
      coverage,
      access: result.access,
      message: result.message,
      itemCount: 0,
      checked: false,
    };
  }

  if (coverage === 'blocked_or_access_denied') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'restricted',
      disposition:
        requirement === 'manual' || requirement === 'user_credentials'
          ? 'manual_action'
          : 'paid_access',
      outcome: result.outcome,
      coverage,
      access: result.access,
      message: result.message,
      itemCount: result.items.length,
      checked: true,
    };
  }

  if (coverage === 'failed') {
    return {
      sourceId: result.sourceId,
      attemptStatus: 'failed',
      disposition: 'unavailable',
      outcome: result.outcome,
      coverage,
      access: result.access,
      message: result.message,
      itemCount: 0,
      checked: true,
    };
  }

  return {
    sourceId: result.sourceId,
    attemptStatus: 'completed',
    disposition: 'completed',
    outcome: result.outcome,
    coverage,
    access: result.access,
    message: result.message,
    itemCount: result.items.length,
    checked: coverageWasAttempted(coverage),
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
