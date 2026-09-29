import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertResearchSourceResult } from '@integrations/expert-research';
import { normalizeProfessionalRecords } from './professional-normalizer';
import type {
  ProfessionalBackgroundDossier,
  ProfessionalRecord,
  ProfessionalSourceAttempt,
} from './professional.types';

/**
 * Builds the professional/financial dossier from collected evidence.
 * Does not invent percentages, bias, or military service conclusions.
 */
export function buildProfessionalBackgroundDossier(input: {
  evidence: ExpertEvidenceItem[];
  sourceResults?: ExpertResearchSourceResult[];
  professionalProviderIds?: readonly string[];
}): ProfessionalBackgroundDossier {
  const records = normalizeProfessionalRecords(input.evidence).filter(
    (record) => record.identityMatch !== 'uncertain',
  );

  return {
    grants: chronological(
      records.filter(
        (record) => record.kind === 'grant' || record.kind === 'grant_result',
      ),
    ),
    patentsAndTrademarks: chronological(
      records.filter(
        (record) => record.kind === 'patent' || record.kind === 'trademark',
      ),
    ),
    awardsAndMedals: chronological(
      records.filter(
        (record) => record.kind === 'award' || record.kind === 'military_medal',
      ),
    ),
    militaryClaims: chronological(
      records.filter(
        (record) =>
          record.kind === 'military_claim' || record.kind === 'military_medal',
      ),
    ),
    memberships: chronological(
      records.filter((record) => record.kind === 'membership'),
    ),
    organizations: chronological(
      records.filter((record) => record.kind === 'professional_organization'),
    ),
    corporateAffiliations: chronological(
      records.filter((record) => record.kind === 'corporate_affiliation'),
    ),
    financial: chronological(
      records.filter(
        (record) =>
          record.kind === 'open_payments' ||
          record.kind === 'forensic_income' ||
          record.kind === 'other_public_income',
      ),
    ),
    records,
    sourceAttempts: sourceAttemptsFor(
      input.sourceResults ?? [],
      input.professionalProviderIds,
    ),
  };
}

export function hasEstimatedPercentage(record: ProfessionalRecord): boolean {
  return Boolean(
    (record.percentForensicWork &&
      /estimat|approx|roughly|about/i.test(record.percentForensicWork)) ||
    (record.percentDefenseWork &&
      /estimat|approx|roughly|about/i.test(record.percentDefenseWork)),
  );
}

function chronological(records: ProfessionalRecord[]): ProfessionalRecord[] {
  return records
    .slice()
    .sort((left, right) => compareDatesAsc(left.sortDate, right.sortDate));
}

function sourceAttemptsFor(
  results: ExpertResearchSourceResult[],
  professionalProviderIds?: readonly string[],
): ProfessionalSourceAttempt[] {
  const allowed = professionalProviderIds
    ? new Set(professionalProviderIds)
    : null;
  return results
    .filter((result) => (allowed ? allowed.has(result.sourceId) : true))
    .map((result) => ({
      sourceId: result.sourceId,
      status: result.status,
      outcome: result.outcome,
      access: result.access,
      message: result.message,
      itemCount: result.items.length,
    }));
}

function compareDatesAsc(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}
