import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { EwiRequestTarget } from './ewi-request.types';

/**
 * Builds request targets from collected investigation evidence.
 * Never invents recipient emails. Missing recipients require manual review.
 */
export function targetsFromEvidence(
  evidence: ExpertEvidenceItem[],
): EwiRequestTarget[] {
  const targets: EwiRequestTarget[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    if (item.identityMatch === 'uncertain') continue;
    const raw = item.raw ?? {};
    const organization =
      readString(raw.institution) ||
      readString(raw.organization) ||
      readString(raw.university) ||
      organizationFromTitle(item.title);
    if (!organization) continue;

    const recipientEmail =
      readString(raw.requestEmail) ||
      readString(raw.recordsEmail) ||
      readString(raw.contactEmail);

    if (
      item.category === 'education' ||
      item.sourceId === 'education_verification'
    ) {
      pushUnique(targets, seen, {
        type: 'graduation_announcement',
        organizationName: organization,
        recipientEmail,
        claimedDegree:
          readString(raw.degree) ||
          readString(raw.claimedDegree) ||
          'Degree on file',
        claimedYear:
          readString(raw.graduationYear) ||
          readString(raw.claimedYear) ||
          readString(raw.year) ||
          'Year on file',
        forceManualReview: !recipientEmail,
      });
      pushUnique(targets, seen, {
        type: 'university_file',
        organizationName: organization,
        recipientEmail,
        recordType:
          readString(raw.recordType) ||
          'Education file / enrollment verification',
        dateRange:
          readString(raw.dateRange) ||
          [readString(raw.startYear), readString(raw.endYear)]
            .filter(Boolean)
            .join('-') ||
          'Dates on file',
        forceManualReview: !recipientEmail,
      });
    }

    if (
      item.category === 'university' ||
      item.category === 'university_rules' ||
      item.sourceId === 'university'
    ) {
      pushUnique(targets, seen, {
        type: 'university_employment',
        organizationName: organization,
        recipientEmail,
        employmentRole:
          readString(raw.role) ||
          readString(raw.title) ||
          'Faculty / employment role on file',
        activityDescription:
          readString(raw.activity) ||
          item.summary ||
          'Employment or activity information on file',
        forceManualReview: true,
      });
    }

    if (
      item.category === 'foia_request' ||
      readString(raw.professionalKind) === 'foia' ||
      readString(raw.requestKind) === 'foia'
    ) {
      pushUnique(targets, seen, {
        type: 'foia',
        organizationName: organization,
        recipientEmail,
        requestDescription:
          readString(raw.requestDescription) ||
          'Discoverable public information regarding the expert, including applicable fees.',
        forceManualReview: !recipientEmail,
      });
    }
  }

  return targets;
}

function pushUnique(
  targets: EwiRequestTarget[],
  seen: Set<string>,
  target: EwiRequestTarget,
): void {
  const key = `${target.type}:${target.organizationName.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  targets.push(target);
}

function organizationFromTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  if (/fixture|development/i.test(trimmed)) return null;
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
