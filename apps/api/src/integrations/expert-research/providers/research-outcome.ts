import type {
  ExpertResearchSourceResult,
  ResearchCoverage,
  ResearchOutcome,
  SourceAccessClass,
} from '../expert-research.types';

const NOT_CONFIGURED =
  /no API key|not configured \(no API key\)|no web search provider is configured/i;
const NOT_IMPLEMENTED =
  /live adapter is not connected|no adapter is registered|no request was sent/i;
const BLOCKED =
  /restricted|pdfs are not stored|bot protection|captcha|paywall|access denied|access wall/i;
const SKIPPED = /skipped|already collected/i;

export function researchOutcomeFor(input: {
  status: ExpertResearchSourceResult['status'];
  access: SourceAccessClass;
  message?: string;
  itemCount: number;
  conflicting?: boolean;
}): ResearchOutcome {
  const message = input.message ?? '';
  if (NOT_CONFIGURED.test(message)) return 'not_configured';
  if (NOT_IMPLEMENTED.test(message)) return 'not_implemented';
  if (/rate limit/i.test(message)) return 'rate_limited';
  if (/timed out/i.test(message)) return 'timeout';
  if (input.access === 'restricted' || BLOCKED.test(message)) {
    return 'restricted';
  }
  if (/authorized access|authentication required/i.test(message)) {
    return 'authentication_required';
  }
  if (input.status === 'error') return 'api_failure';
  if (input.status === 'no_result') return 'no_result';
  if (input.status === 'ok' && input.itemCount === 0) {
    return 'unavailable';
  }
  if (input.status === 'skipped') return 'unavailable';
  if (input.status === 'unavailable') return 'unavailable';
  if (input.conflicting) return 'conflicting';
  return 'success';
}

export function researchCoverageFor(input: {
  status?: string | null;
  outcome?: string | null;
  message?: string | null;
  itemCount?: number;
  access?: string | null;
  skipped?: boolean;
}): ResearchCoverage {
  const message = input.message ?? '';
  const itemCount = input.itemCount ?? 0;
  if (input.skipped || input.status === 'skipped' || SKIPPED.test(message)) {
    return 'skipped';
  }
  // Historical rows may store outcome=restricted even when no request was sent.
  if (NOT_CONFIGURED.test(message)) return 'not_configured';
  if (NOT_IMPLEMENTED.test(message)) return 'not_implemented';
  if (neverContactedRestricted(input)) return 'not_implemented';
  if (
    input.status === 'ok' &&
    itemCount === 0 &&
    input.outcome !== 'no_result'
  ) {
    return 'pending';
  }
  const outcome =
    input.outcome && isResearchOutcome(input.outcome)
      ? input.outcome
      : researchOutcomeFor({
          status: asSourceStatus(input.status),
          access: asAccess(input.access),
          message,
          itemCount,
        });
  return coverageFromOutcome(outcome, input.status, itemCount);
}

/** Restricted catalogs with no attempt are not empty searches or access walls. */
function neverContactedRestricted(input: {
  status?: string | null;
  outcome?: string | null;
  itemCount?: number;
  access?: string | null;
}): boolean {
  if ((input.itemCount ?? 0) > 0) return false;
  if (
    input.status === 'error' ||
    input.status === 'no_result' ||
    input.status === 'ok'
  ) {
    return false;
  }
  return (
    input.access === 'restricted' ||
    input.outcome === 'restricted' ||
    input.outcome === 'authentication_required'
  );
}

export function coverageFromOutcome(
  outcome: ResearchOutcome,
  status?: string | null,
  itemCount = 0,
): ResearchCoverage {
  if (outcome === 'not_configured') return 'not_configured';
  if (outcome === 'not_implemented') return 'not_implemented';
  if (outcome === 'restricted' || outcome === 'authentication_required') {
    return 'blocked_or_access_denied';
  }
  if (
    outcome === 'timeout' ||
    outcome === 'api_failure' ||
    outcome === 'rate_limited'
  ) {
    return 'failed';
  }
  if (status === 'skipped') return 'skipped';
  if (outcome === 'unavailable') {
    return status === 'error' ? 'failed' : 'not_implemented';
  }
  if (outcome === 'no_result' || status === 'no_result') {
    return 'searched_no_results';
  }
  if (itemCount > 0 || outcome === 'conflicting') {
    return 'searched_with_results';
  }
  if (outcome === 'success' && itemCount > 0) {
    return 'searched_with_results';
  }
  return 'pending';
}

/** True when the source was actually consulted (including a failed attempt). */
export function coverageWasAttempted(coverage: ResearchCoverage): boolean {
  return (
    coverage === 'searched_with_results' ||
    coverage === 'searched_no_results' ||
    coverage === 'failed' ||
    coverage === 'blocked_or_access_denied'
  );
}

function isResearchOutcome(value: string): value is ResearchOutcome {
  return (
    value === 'success' ||
    value === 'no_result' ||
    value === 'unavailable' ||
    value === 'restricted' ||
    value === 'authentication_required' ||
    value === 'rate_limited' ||
    value === 'timeout' ||
    value === 'api_failure' ||
    value === 'conflicting' ||
    value === 'not_implemented' ||
    value === 'not_configured'
  );
}

function asSourceStatus(
  status: string | null | undefined,
): ExpertResearchSourceResult['status'] {
  if (
    status === 'ok' ||
    status === 'skipped' ||
    status === 'error' ||
    status === 'unavailable' ||
    status === 'no_result'
  ) {
    return status;
  }
  return 'unavailable';
}

function asAccess(access: string | null | undefined): SourceAccessClass {
  if (
    access === 'public' ||
    access === 'restricted' ||
    access === 'unavailable'
  ) {
    return access;
  }
  return 'unavailable';
}
