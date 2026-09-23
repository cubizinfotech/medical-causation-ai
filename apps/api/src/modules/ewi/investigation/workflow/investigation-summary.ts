import type { ExpertEvidenceItem } from '@integrations/expert-research';

export interface StageNote {
  label: string;
  message: string;
}

/**
 * Lists only statements that were collected. Does not confirm credentials.
 */
export function buildInvestigationSummary(input: {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  stageNotes: StageNote[];
}): string {
  const lines = [
    `Investigation for ${input.expertName} (${input.specialty}).`,
    'This summary lists collected statements only. It does not confirm a credential, publication, case, license, award, or other qualification.',
  ];

  for (const stage of input.stageNotes) {
    lines.push(`${stage.label}: ${stage.message}`);
  }

  if (input.evidence.length === 0) {
    lines.push('No research items were collected.');
    return lines.join('\n');
  }

  lines.push('Collected items:');
  for (const item of input.evidence) {
    const status = item.informationStatus ?? 'unverified';
    const url = item.url ? ` ${item.url}` : '';
    const restricted =
      item.access === 'restricted'
        ? ' Restricted source; content was not stored.'
        : '';
    lines.push(
      `- [${status}] ${item.title} (${item.sourceId}).${url}${restricted}`,
    );
  }
  return lines.join('\n');
}
