/**
 * Normalized online presence records.
 * Values come only from collected public or permitted source statements.
 */

export const PRESENCE_KINDS = [
  'expert_website',
  'professional_website',
  'ime_website',
  'directory',
  'youtube',
  'video',
  'presentation',
  'powerpoint',
  'social',
  'news',
  'blog',
  'patient_review',
  'google_maps',
  'other_public_website',
] as const;

export type PresenceKind = (typeof PRESENCE_KINDS)[number];

export const SOCIAL_PLATFORMS = [
  'facebook',
  'linkedin',
  'x',
  'twitter',
  'youtube',
  'tiktok',
  'instagram',
  'meta',
  'bluesky',
  'other',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const LOCATION_VERIFICATION_FLAGS = [
  'possible_residence',
  'shared_or_hourly_office',
  'requires_verification',
] as const;

export type LocationVerificationFlag =
  (typeof LOCATION_VERIFICATION_FLAGS)[number];

/** Attribute keys that may be stored for restricted online-presence sources. */
export const PRESENCE_METADATA_KEYS = [
  'presenceKind',
  'platform',
  'pageTitle',
  'retrievedAt',
  'publishedAt',
  'publicationDate',
  'date',
  'relevantClaims',
  'advertisingClaims',
  'forensicClaims',
  'expertWitnessClaims',
  'treatmentPracticeInfo',
  'conflictOrBiasIndicators',
  'evidenceReference',
  'evidenceReferences',
  'description',
  'transcript',
  'transcriptAvailable',
  'transcriptUnavailableReason',
  'importantStatements',
  'shortDescription',
  'rating',
  'reviewDate',
  'reviewTextPermitted',
  'neutralSummary',
  'address',
  'businessName',
  'locationFlags',
  'locationNote',
  'metadataOnly',
  'identity',
  'claimedStates',
  'claimedBoard',
] as const;

export interface PresenceRecord {
  id: string;
  kind: PresenceKind;
  title: string;
  url: string | null;
  sourceId: string;
  sourceName: string;
  retrievedAt: string | null;
  publishedAt: string | null;
  summary: string | null;
  relevantClaims: string[];
  advertisingClaims: string[];
  forensicClaims: string[];
  expertWitnessClaims: string[];
  treatmentPracticeInfo: string | null;
  conflictOrBiasIndicators: string[];
  evidenceReferences: string[];
  restricted: boolean;
  identityMatch: 'matched' | 'uncertain' | undefined;
  platform: SocialPlatform | null;
  description: string | null;
  transcript: string | null;
  transcriptAvailable: boolean | null;
  transcriptUnavailableReason: string | null;
  importantStatements: string[];
  rating: string | null;
  reviewDate: string | null;
  reviewText: string | null;
  neutralSummary: string | null;
  address: string | null;
  businessName: string | null;
  locationFlags: LocationVerificationFlag[];
  locationNote: string | null;
}

export interface PresenceSourceAttempt {
  sourceId: string;
  status: string;
  outcome?: string;
  access?: string;
  message?: string;
  itemCount: number;
}

export interface OnlinePresenceDossier {
  websites: PresenceRecord[];
  directories: PresenceRecord[];
  ime: PresenceRecord[];
  videos: PresenceRecord[];
  social: PresenceRecord[];
  newsAndBlogs: PresenceRecord[];
  patientReviews: PresenceRecord[];
  locations: PresenceRecord[];
  otherPublicSites: PresenceRecord[];
  records: PresenceRecord[];
  sourceAttempts: PresenceSourceAttempt[];
}
