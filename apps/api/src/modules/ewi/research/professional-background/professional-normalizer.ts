import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  PROFESSIONAL_KINDS,
  type ProfessionalKind,
  type ProfessionalRecord,
} from './professional.types';

const PROFESSIONAL_PROVIDERS = new Set([
  'grants',
  'grant_results',
  'patents',
  'trademarks',
  'awards',
  'military_claims',
  'memberships',
  'professional_organizations',
  'corporate_affiliations',
  'open_payments',
]);

const PROFESSIONAL_CATEGORIES = new Set([
  'grant',
  'patent',
  'award',
  'military',
  'membership',
  'corporate_affiliation',
  'income_bias',
]);

/**
 * Builds professional/financial records only from collected evidence fields.
 * Does not invent grants, awards, memberships, percentages, or bias conclusions.
 */
export function normalizeProfessionalRecords(
  items: ExpertEvidenceItem[],
): ProfessionalRecord[] {
  const records: ProfessionalRecord[] = [];
  for (const [index, item] of items.entries()) {
    if (!isProfessionalItem(item)) continue;
    records.push(recordFromItem(item, index));
  }
  return records;
}

export function isProfessionalItem(item: ExpertEvidenceItem): boolean {
  return (
    PROFESSIONAL_PROVIDERS.has(item.sourceId) ||
    PROFESSIONAL_CATEGORIES.has(item.category)
  );
}

function recordFromItem(
  item: ExpertEvidenceItem,
  index: number,
): ProfessionalRecord {
  const raw = item.raw ?? {};
  const restricted = item.access === 'restricted';
  const kind = resolveKind(item, raw);
  const resultsAvailable = readBoolean(raw.resultsAvailable);
  const filingDate = readString(raw.filingDate);
  const startDate = readString(raw.startDate);
  const endDate = readString(raw.endDate);
  const paymentDate = readString(raw.paymentDate);
  const publishedAt =
    readString(raw.publishedAt) ??
    readString(raw.publicationDate) ??
    readString(raw.date);
  const sortDate =
    paymentDate ?? filingDate ?? startDate ?? endDate ?? publishedAt;

  return {
    id: `professional-${index + 1}`,
    kind,
    title: readString(raw.title) ?? item.title,
    name: readString(raw.name),
    identifier:
      readString(raw.identifier) ??
      readString(raw.grantId) ??
      readString(raw.patentNumber) ??
      readString(raw.trademarkNumber),
    filingDate,
    startDate,
    endDate,
    status: readString(raw.status),
    role: readString(raw.role),
    participation: readString(raw.participation),
    authorship: readString(raw.authorship),
    institution: readString(raw.institution),
    organization: readString(raw.organization),
    sourceId: item.sourceId,
    sourceName: item.source?.name ?? item.sourceId,
    sourceUrl: item.url ?? null,
    resultUrl: readString(raw.resultUrl),
    resultsAvailable,
    resultsUnavailableReason:
      resultsAvailable === false
        ? (readString(raw.resultsUnavailableReason) ??
          'Private foundation results were unavailable.')
        : null,
    cvClaim: readString(raw.cvClaim),
    publicRecord: readString(raw.publicRecord),
    paymentDate,
    paymentAmount: readString(raw.paymentAmount),
    payer: readString(raw.payer),
    natureOfPayment: readString(raw.natureOfPayment),
    forensicWork: readString(raw.forensicWork),
    defenseWork: readString(raw.defenseWork),
    hourlyRate: readString(raw.hourlyRate),
    referralInfo: readString(raw.referralInfo),
    percentForensicWork: readString(raw.percentForensicWork),
    percentDefenseWork: readString(raw.percentDefenseWork),
    summary: restricted
      ? (readString(raw.neutralSummary) ?? readString(raw.shortDescription))
      : item.summary?.trim() ||
        readString(raw.neutralSummary) ||
        readString(raw.shortDescription) ||
        null,
    verificationNote: readString(raw.verificationNote),
    evidenceReferences: evidenceRefs(item, raw),
    restricted,
    identityMatch: item.identityMatch,
    sortDate,
  };
}

function resolveKind(
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
): ProfessionalKind {
  const stated = readString(raw.professionalKind)?.toLowerCase();
  if (stated && isProfessionalKind(stated)) return stated;

  switch (item.sourceId) {
    case 'grants':
      return 'grant';
    case 'grant_results':
      return 'grant_result';
    case 'patents':
      return 'patent';
    case 'trademarks':
      return 'trademark';
    case 'awards':
      return 'award';
    case 'military_claims':
      return readString(raw.professionalKind) === 'military_medal' ||
        Boolean(readString(raw.medal))
        ? 'military_medal'
        : 'military_claim';
    case 'memberships':
      return 'membership';
    case 'professional_organizations':
      return 'professional_organization';
    case 'corporate_affiliations':
      return 'corporate_affiliation';
    case 'open_payments':
      return 'open_payments';
    default:
      break;
  }

  if (item.category === 'grant') return 'grant';
  if (item.category === 'patent') return 'patent';
  if (item.category === 'award') return 'award';
  if (item.category === 'military') return 'military_claim';
  if (item.category === 'membership') return 'membership';
  if (item.category === 'corporate_affiliation') return 'corporate_affiliation';
  if (item.category === 'income_bias') {
    if (readString(raw.forensicWork) || readString(raw.defenseWork)) {
      return 'forensic_income';
    }
    return 'open_payments';
  }
  return 'other_public_income';
}

function evidenceRefs(
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
): string[] {
  const listed = readStringList(raw.evidenceReferences);
  const single = readString(raw.evidenceReference);
  const refs = [...listed];
  if (single) refs.push(single);
  if (refs.length === 0) refs.push(item.title);
  return [...new Set(refs)];
}

function isProfessionalKind(value: string): value is ProfessionalKind {
  return (PROFESSIONAL_KINDS as readonly string[]).includes(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}
