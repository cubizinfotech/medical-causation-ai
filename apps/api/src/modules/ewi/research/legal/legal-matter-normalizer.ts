import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  LEGAL_DOCUMENT_TYPES,
  ORDER_SIGNIFICANCE_TAGS,
  type LegalDocumentType,
  type LegalMatter,
  type OrderSignificanceTag,
} from './legal-matter.types';

const LEGAL_CATEGORIES = new Set([
  'legal',
  'legal_case',
  'court_order',
  'motion',
  'deposition',
  'testimony',
  'criminal_record',
  'malpractice',
]);

const LEGAL_PROVIDERS = new Set([
  'courtlistener',
  'justia',
  'state_court_records',
  'motions',
  'orders',
  'pleadings',
  'depositions',
  'expert_testimony',
  'lexisnexis',
  'criminal_records',
  'malpractice_records',
]);

/**
 * Builds legal matters only from collected evidence fields.
 * Titles and summaries are not turned into court findings that the source did not state.
 */
export function normalizeLegalMatters(
  items: ExpertEvidenceItem[],
): LegalMatter[] {
  const matters: LegalMatter[] = [];
  for (const [index, item] of items.entries()) {
    if (!isLegalItem(item)) continue;
    matters.push(matterFromItem(item, index));
  }
  return matters;
}

export function isLegalItem(item: ExpertEvidenceItem): boolean {
  return (
    LEGAL_CATEGORIES.has(item.category) || LEGAL_PROVIDERS.has(item.sourceId)
  );
}

function matterFromItem(item: ExpertEvidenceItem, index: number): LegalMatter {
  const raw = item.raw ?? {};
  const documentType = resolveDocumentType(item, raw);
  const caseName = readString(raw.caseName) ?? null;
  const documentDate =
    readString(raw.documentDate) ??
    readString(raw.date) ??
    readString(raw.publishedAt) ??
    readString(raw.publicationDate) ??
    null;
  const filingDate = readString(raw.filingDate) ?? documentDate;
  const restricted = item.access === 'restricted';
  const summary = restricted
    ? readString(raw.shortDescription)
    : item.summary?.trim() || readString(raw.summary) || null;

  return {
    id: `legal-${index + 1}`,
    documentType,
    caseName,
    caseNumber: readString(raw.caseNumber),
    court: readString(raw.court),
    jurisdiction: readString(raw.jurisdiction),
    filingDate,
    documentDate,
    sourceUrl: item.url ?? null,
    sourceId: item.sourceId,
    sourceName: item.source?.name ?? item.sourceId,
    relevance: readString(raw.relevance),
    summary,
    findingsRegardingExpert: readString(raw.findingsRegardingExpert),
    evidenceReference: readString(raw.evidenceReference) ?? item.title,
    title: item.title,
    restricted,
    identityMatch: item.identityMatch,
    orderTags: readOrderTags(raw),
    shortDescription: readString(raw.shortDescription) ?? summary,
    transcriptMetadata: readString(raw.transcriptMetadata),
    importantStatements: readStringList(raw.importantStatements),
  };
}

function resolveDocumentType(
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
): LegalDocumentType {
  const stated = readString(raw.documentType)?.toLowerCase();
  if (stated && isDocumentType(stated)) return stated;

  const matterKind = readString(raw.matterKind)?.toLowerCase();
  if (matterKind === 'malpractice') return 'malpractice';
  if (matterKind === 'expert_witness_case' || matterKind === 'expert_witness') {
    return 'expert_witness_case';
  }
  if (matterKind === 'criminal') return 'criminal_record';

  switch (item.category) {
    case 'court_order':
      return 'order';
    case 'motion':
      return item.sourceId === 'pleadings' ? 'pleading' : 'motion';
    case 'deposition':
      return 'deposition';
    case 'testimony':
      return 'testimony';
    case 'criminal_record':
      return 'criminal_record';
    case 'malpractice':
      return 'malpractice';
    default:
      break;
  }

  if (item.sourceId === 'orders') return 'order';
  if (item.sourceId === 'motions') return 'motion';
  if (item.sourceId === 'pleadings') return 'pleading';
  if (item.sourceId === 'depositions') return 'deposition';
  if (item.sourceId === 'expert_testimony') return 'testimony';
  if (item.sourceId === 'criminal_records') return 'criminal_record';
  if (item.sourceId === 'malpractice_records') return 'malpractice';
  return 'case';
}

function readOrderTags(raw: Record<string, unknown>): OrderSignificanceTag[] {
  const tags = raw.orderTags;
  if (!Array.isArray(tags)) return [];
  const allowed = new Set<string>(ORDER_SIGNIFICANCE_TAGS);
  const found: OrderSignificanceTag[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const value = tag.trim().toLowerCase();
    if (!allowed.has(value)) continue;
    if (!found.includes(value as OrderSignificanceTag)) {
      found.push(value as OrderSignificanceTag);
    }
  }
  return found;
}

function isDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value);
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
