import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertResearchSourceResult } from '@integrations/expert-research';
import { normalizePresenceRecords } from './presence-normalizer';
import type {
  OnlinePresenceDossier,
  PresenceRecord,
  PresenceSourceAttempt,
} from './presence.types';

/**
 * Builds the online presence dossier from collected evidence.
 * Does not invent claims, download restricted content, or draw medical/legal conclusions.
 */
export function buildOnlinePresenceDossier(input: {
  evidence: ExpertEvidenceItem[];
  sourceResults?: ExpertResearchSourceResult[];
  presenceProviderIds?: readonly string[];
}): OnlinePresenceDossier {
  const records = normalizePresenceRecords(input.evidence).filter(
    (record) => record.identityMatch !== 'uncertain',
  );

  return {
    websites: records.filter(
      (record) =>
        record.kind === 'expert_website' ||
        record.kind === 'professional_website',
    ),
    directories: records.filter((record) => record.kind === 'directory'),
    ime: records.filter((record) => record.kind === 'ime_website'),
    videos: records.filter(
      (record) =>
        record.kind === 'youtube' ||
        record.kind === 'video' ||
        record.kind === 'presentation' ||
        record.kind === 'powerpoint',
    ),
    social: records.filter((record) => record.kind === 'social'),
    newsAndBlogs: records.filter(
      (record) => record.kind === 'news' || record.kind === 'blog',
    ),
    patientReviews: records.filter(
      (record) => record.kind === 'patient_review',
    ),
    locations: records.filter((record) => record.kind === 'google_maps'),
    otherPublicSites: records.filter(
      (record) =>
        record.kind === 'other_public_website' &&
        !looksLikeNonWebsitePresence(record),
    ),
    records,
    sourceAttempts: sourceAttemptsFor(
      input.sourceResults ?? [],
      input.presenceProviderIds,
    ),
  };
}

export function locationRequiresVerification(record: PresenceRecord): boolean {
  return (
    record.kind === 'google_maps' &&
    (record.locationFlags.includes('requires_verification') ||
      record.locationFlags.includes('possible_residence') ||
      record.locationFlags.includes('shared_or_hourly_office'))
  );
}

/** Journal, court, and news URLs must not pad the Expert Websites catch-all. */
function looksLikeNonWebsitePresence(record: PresenceRecord): boolean {
  const hay =
    `${record.url ?? ''} ${record.title} ${record.summary ?? ''}`.toLowerCase();
  return (
    /\b(pubmed\.ncbi|doi\.org|openalex\.org|orcid\.org|researchgate\.net|semanticscholar\.org)\b/.test(
      hay,
    ) ||
    /\b(courtlistener\.com|justia\.com|casetext\.com|leagle\.com|govinfo\.gov|uscourts\.gov)\b/.test(
      hay,
    ) ||
    /\b(complaint|motion to|memorandum opinion|deposition of|journal article)\b/.test(
      hay,
    )
  );
}

function sourceAttemptsFor(
  results: ExpertResearchSourceResult[],
  presenceProviderIds?: readonly string[],
): PresenceSourceAttempt[] {
  const allowed = presenceProviderIds ? new Set(presenceProviderIds) : null;
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
