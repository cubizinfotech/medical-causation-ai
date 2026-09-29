import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  LOCATION_VERIFICATION_FLAGS,
  PRESENCE_KINDS,
  SOCIAL_PLATFORMS,
  type LocationVerificationFlag,
  type PresenceKind,
  type PresenceRecord,
  type SocialPlatform,
} from './presence.types';

const PRESENCE_PROVIDERS = new Set([
  'expert_website',
  'advertising',
  'other_public_websites',
  'ime_websites',
  'ime_advertising',
  'expert_directory',
  'dri',
  'seak',
  'alm_law',
  'jurispro',
  'expertlaw',
  'expertpages',
  'expertwitness_com',
  'other_expert_directories',
  'youtube',
  'presentations',
  'powerpoints',
  'social',
  'news',
  'blogs',
  'patient_reviews',
  'google_maps',
]);

const PRESENCE_CATEGORIES = new Set([
  'website',
  'advertising',
  'ime',
  'directory',
  'video',
  'presentation',
  'powerpoint',
  'social',
  'news',
  'patient_review',
  'office',
]);

/**
 * Builds presence records only from collected evidence fields.
 * Does not invent advertising claims, reviews, or location conclusions.
 */
export function normalizePresenceRecords(
  items: ExpertEvidenceItem[],
): PresenceRecord[] {
  const records: PresenceRecord[] = [];
  for (const [index, item] of items.entries()) {
    if (!isPresenceItem(item)) continue;
    records.push(recordFromItem(item, index));
  }
  return records;
}

export function isPresenceItem(item: ExpertEvidenceItem): boolean {
  return (
    PRESENCE_PROVIDERS.has(item.sourceId) ||
    PRESENCE_CATEGORIES.has(item.category)
  );
}

function recordFromItem(
  item: ExpertEvidenceItem,
  index: number,
): PresenceRecord {
  const raw = item.raw ?? {};
  const restricted = item.access === 'restricted';
  const kind = resolveKind(item, raw);
  const transcriptAvailable = readBoolean(raw.transcriptAvailable);
  const transcript =
    restricted || transcriptAvailable === false
      ? null
      : readString(raw.transcript);
  const summary = restricted
    ? (readString(raw.neutralSummary) ?? readString(raw.shortDescription))
    : item.summary?.trim() ||
      readString(raw.neutralSummary) ||
      readString(raw.shortDescription) ||
      null;

  return {
    id: `presence-${index + 1}`,
    kind,
    title: readString(raw.pageTitle) ?? item.title,
    url: item.url ?? null,
    sourceId: item.sourceId,
    sourceName: item.source?.name ?? item.sourceId,
    retrievedAt: item.retrievedAt ?? readString(raw.retrievedAt),
    publishedAt:
      readString(raw.publishedAt) ??
      readString(raw.publicationDate) ??
      readString(raw.date) ??
      readString(raw.reviewDate),
    summary,
    relevantClaims: readStringList(raw.relevantClaims),
    advertisingClaims: readStringList(raw.advertisingClaims),
    forensicClaims: readStringList(raw.forensicClaims),
    expertWitnessClaims: readStringList(raw.expertWitnessClaims),
    treatmentPracticeInfo: readString(raw.treatmentPracticeInfo),
    conflictOrBiasIndicators: readStringList(raw.conflictOrBiasIndicators),
    evidenceReferences: evidenceRefs(item, raw),
    restricted,
    identityMatch: item.identityMatch,
    platform: readPlatform(raw.platform),
    description: restricted ? null : readString(raw.description),
    transcript,
    transcriptAvailable,
    transcriptUnavailableReason:
      transcriptAvailable === false
        ? (readString(raw.transcriptUnavailableReason) ??
          'Transcription was unavailable.')
        : restricted && isVideoKind(kind)
          ? 'Restricted source. Transcript body was not stored.'
          : null,
    importantStatements: readStringList(raw.importantStatements),
    rating: readString(raw.rating),
    reviewDate: readString(raw.reviewDate) ?? readString(raw.date),
    reviewText: restricted
      ? null
      : readBoolean(raw.reviewTextPermitted) === false
        ? null
        : readString(raw.reviewText),
    neutralSummary: readString(raw.neutralSummary) ?? summary,
    address: readString(raw.address),
    businessName: readString(raw.businessName),
    locationFlags: readLocationFlags(raw),
    locationNote: readString(raw.locationNote),
  };
}

function resolveKind(
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
): PresenceKind {
  const stated = readString(raw.presenceKind)?.toLowerCase();
  if (stated && isPresenceKind(stated)) return stated;

  switch (item.sourceId) {
    case 'expert_website':
      return 'expert_website';
    case 'advertising':
      return 'professional_website';
    case 'other_public_websites':
      return 'other_public_website';
    case 'ime_websites':
    case 'ime_advertising':
      return 'ime_website';
    case 'youtube':
      return 'youtube';
    case 'presentations':
      return 'presentation';
    case 'powerpoints':
      return 'powerpoint';
    case 'social':
      return 'social';
    case 'news':
      return 'news';
    case 'blogs':
      return 'blog';
    case 'patient_reviews':
      return 'patient_review';
    case 'google_maps':
      return 'google_maps';
    default:
      break;
  }

  if (item.sourceId.includes('directory') || item.category === 'directory') {
    return 'directory';
  }
  if (item.category === 'video') return 'video';
  if (item.category === 'presentation') return 'presentation';
  if (item.category === 'powerpoint') return 'powerpoint';
  if (item.category === 'social') return 'social';
  if (item.category === 'news') return 'news';
  if (item.category === 'patient_review') return 'patient_review';
  if (item.category === 'office') return 'google_maps';
  if (item.category === 'ime' || item.category === 'advertising') {
    return item.category === 'ime' ? 'ime_website' : 'professional_website';
  }
  return 'other_public_website';
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

function isVideoKind(kind: PresenceKind): boolean {
  return (
    kind === 'youtube' ||
    kind === 'video' ||
    kind === 'presentation' ||
    kind === 'powerpoint'
  );
}

function isPresenceKind(value: string): value is PresenceKind {
  return (PRESENCE_KINDS as readonly string[]).includes(value);
}

function readPlatform(value: unknown): SocialPlatform | null {
  const text = readString(value)?.toLowerCase();
  if (!text) return null;
  if (text === 'twitter') return 'x';
  if ((SOCIAL_PLATFORMS as readonly string[]).includes(text)) {
    return text as SocialPlatform;
  }
  return 'other';
}

function readLocationFlags(
  raw: Record<string, unknown>,
): LocationVerificationFlag[] {
  const flags = raw.locationFlags;
  if (!Array.isArray(flags)) return [];
  const allowed = new Set<string>(LOCATION_VERIFICATION_FLAGS);
  const found: LocationVerificationFlag[] = [];
  for (const flag of flags) {
    if (typeof flag !== 'string') continue;
    const value = flag.trim().toLowerCase();
    if (!allowed.has(value)) continue;
    if (!found.includes(value as LocationVerificationFlag)) {
      found.push(value as LocationVerificationFlag);
    }
  }
  return found;
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
