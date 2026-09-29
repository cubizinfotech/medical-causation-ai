import {
  buildOnlinePresenceDossier,
  locationRequiresVerification,
} from './presence-research-analyzer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';

function item(
  partial: Pick<ExpertEvidenceItem, 'sourceId' | 'category' | 'title'> &
    Partial<ExpertEvidenceItem>,
): ExpertEvidenceItem {
  return {
    summary: 'Collected public statement',
    access: 'public',
    informationStatus: 'unverified',
    identityMatch: 'matched',
    retrievedAt: '2026-09-29T00:00:00.000Z',
    ...partial,
  };
}

describe('online presence research', () => {
  it('collects website metadata and claims without inventing conclusions', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'expert_website',
          category: 'website',
          title: 'Practice site',
          url: 'https://example.local/about',
          raw: {
            presenceKind: 'expert_website',
            pageTitle: 'About the doctor',
            relevantClaims: ['Board certified'],
            advertisingClaims: ['IME available'],
            forensicClaims: ['Forensic consulting'],
            expertWitnessClaims: ['Retained expert work'],
            treatmentPracticeInfo: 'Outpatient clinic',
            conflictOrBiasIndicators: [
              'Site markets clinical care and retained expert work.',
            ],
            evidenceReference: 'About page',
          },
        }),
      ],
    });

    expect(dossier.websites).toHaveLength(1);
    expect(dossier.websites[0]).toMatchObject({
      url: 'https://example.local/about',
      title: 'About the doctor',
      retrievedAt: '2026-09-29T00:00:00.000Z',
      treatmentPracticeInfo: 'Outpatient clinic',
    });
    expect(dossier.websites[0]?.advertisingClaims).toContain('IME available');
    expect(dossier.websites[0]?.summary).not.toMatch(
      /fraud|liable|malpractice conclusion/i,
    );
  });

  it('stores video links and explains when transcription is unavailable', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'youtube',
          category: 'video',
          title: 'Lecture',
          url: 'https://www.youtube.com/watch?v=example',
          raw: {
            presenceKind: 'youtube',
            date: '2022-04-10',
            description: 'Public lecture',
            transcriptAvailable: false,
            transcriptUnavailableReason:
              'Transcription was unavailable for this public video.',
            importantStatements: ['Discusses methodology'],
          },
        }),
      ],
    });

    expect(dossier.videos[0]).toMatchObject({
      url: 'https://www.youtube.com/watch?v=example',
      transcript: null,
      transcriptAvailable: false,
      transcriptUnavailableReason:
        'Transcription was unavailable for this public video.',
    });
  });

  it('keeps social metadata public-only and does not treat private access as available', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'social',
          category: 'social',
          title: 'LinkedIn',
          access: 'restricted',
          summary: '',
          url: 'https://www.linkedin.com/in/example',
          raw: {
            presenceKind: 'social',
            platform: 'linkedin',
            metadataOnly: true,
            evidenceReference: 'Public LinkedIn metadata',
          },
        }),
      ],
      sourceResults: [
        {
          sourceId: 'social',
          status: 'ok',
          outcome: 'restricted',
          access: 'restricted',
          message: 'Public metadata only. Private accounts were not accessed.',
          retrievedAt: '2026-09-29T00:00:00.000Z',
          items: [],
        },
      ],
      presenceProviderIds: ['social'],
    });

    expect(dossier.social[0]?.platform).toBe('linkedin');
    expect(dossier.social[0]?.restricted).toBe(true);
    expect(dossier.social[0]?.summary).toBeNull();
    expect(dossier.sourceAttempts[0]?.access).toBe('restricted');
  });

  it('marks Google Maps addresses that may be residences or shared offices for verification', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'google_maps',
          category: 'office',
          title: 'Maps listing',
          url: 'https://maps.google.com/?q=example',
          raw: {
            presenceKind: 'google_maps',
            businessName: 'Example Clinic',
            address: '12 Oak Street',
            locationFlags: ['possible_residence', 'requires_verification'],
            locationNote:
              'Listing may be a residence. Address type requires verification.',
          },
        }),
      ],
    });

    expect(dossier.locations).toHaveLength(1);
    expect(locationRequiresVerification(dossier.locations[0])).toBe(true);
    expect(dossier.locations[0]?.locationNote).toMatch(
      /requires verification/i,
    );
    expect(dossier.locations[0]?.locationNote).not.toMatch(
      /is a residence|definitely|concludes/i,
    );
  });

  it('stores patient review metadata with a neutral summary and no medical conclusion', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'patient_reviews',
          category: 'patient_review',
          title: 'Review listing',
          access: 'restricted',
          summary: '',
          url: 'https://example.local/reviews/1',
          raw: {
            presenceKind: 'patient_review',
            reviewDate: '2022-09-01',
            rating: '4/5',
            reviewTextPermitted: false,
            neutralSummary: 'A public listing shows a rating.',
            evidenceReference: 'Patient review metadata',
          },
        }),
      ],
    });

    expect(dossier.patientReviews[0]).toMatchObject({
      url: 'https://example.local/reviews/1',
      rating: '4/5',
      reviewDate: '2022-09-01',
      reviewText: null,
      neutralSummary: 'A public listing shows a rating.',
    });
    expect(dossier.patientReviews[0]?.neutralSummary).not.toMatch(
      /malpractice|negligence|diagnosis/i,
    );
  });

  it('does not merge uncertain identity presence hits', () => {
    const dossier = buildOnlinePresenceDossier({
      evidence: [
        item({
          sourceId: 'news',
          category: 'news',
          title: 'Other person article',
          identityMatch: 'uncertain',
          raw: { presenceKind: 'news' },
        }),
      ],
    });
    expect(dossier.records).toEqual([]);
  });
});
