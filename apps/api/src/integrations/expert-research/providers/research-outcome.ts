import type {
  ExpertResearchSourceResult,
  ResearchOutcome,
  SourceAccessClass,
} from '../expert-research.types';

export function researchOutcomeFor(input: {
  status: ExpertResearchSourceResult['status'];
  access: SourceAccessClass;
  message?: string;
  itemCount: number;
  conflicting?: boolean;
}): ResearchOutcome {
  const message = input.message ?? '';
  if (/rate limit/i.test(message)) return 'rate_limited';
  if (/timed out/i.test(message)) return 'timeout';
  if (
    input.access === 'restricted' ||
    /restricted|pdfs are not stored/i.test(message)
  ) {
    return 'restricted';
  }
  if (/authorized access|authentication required/i.test(message)) {
    return 'authentication_required';
  }
  if (input.status === 'error') return 'api_failure';
  if (
    input.status === 'no_result' ||
    (input.status === 'ok' && input.itemCount === 0)
  ) {
    return 'no_result';
  }
  if (input.status === 'unavailable' || input.status === 'skipped') {
    return 'unavailable';
  }
  if (input.conflicting) return 'conflicting';
  return 'success';
}
