import { targetsFromEvidence } from './ewi-request-from-evidence';
import type { ExpertEvidenceItem } from '@integrations/expert-research';

describe('targetsFromEvidence', () => {
  it('builds graduation and university file targets without inventing recipients', () => {
    const evidence: ExpertEvidenceItem[] = [
      {
        sourceId: 'education_verification',
        category: 'education',
        title: 'Degree claim',
        summary: 'M.D. claimed',
        access: 'public',
        informationStatus: 'unverified',
        identityMatch: 'matched',
        raw: {
          institution: 'State University',
          degree: 'M.D.',
          graduationYear: '2002',
        },
      },
    ];

    const targets = targetsFromEvidence(evidence);
    expect(targets.map((item) => item.type).sort()).toEqual([
      'graduation_announcement',
      'university_file',
    ]);
    expect(targets.every((item) => !item.recipientEmail)).toBe(true);
    expect(targets.every((item) => item.forceManualReview)).toBe(true);
  });

  it('keeps a supplied records email when present', () => {
    const evidence: ExpertEvidenceItem[] = [
      {
        sourceId: 'education_verification',
        category: 'education',
        title: 'Degree claim',
        summary: 'M.D. claimed',
        access: 'public',
        informationStatus: 'unverified',
        identityMatch: 'matched',
        raw: {
          institution: 'State University',
          degree: 'M.D.',
          graduationYear: '2002',
          recordsEmail: 'registrar@state.edu',
        },
      },
    ];
    const targets = targetsFromEvidence(evidence);
    expect(targets[0]?.recipientEmail).toBe('registrar@state.edu');
  });
});
