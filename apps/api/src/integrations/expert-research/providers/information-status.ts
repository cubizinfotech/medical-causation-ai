import type { ExpertEvidenceItem } from '../expert-research.types';

function stateSet(item: ExpertEvidenceItem): Set<string> {
  const states = new Set<string>();
  const state = item.raw?.state;
  if (typeof state === 'string' && state.trim()) states.add(state.trim());
  const claimed = item.raw?.claimedStates;
  if (Array.isArray(claimed)) {
    for (const value of claimed) {
      if (typeof value === 'string' && value.trim()) states.add(value.trim());
    }
  }
  return states;
}

function setsDiffer(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) return false;
  if (left.size !== right.size) return true;
  for (const value of left) {
    if (!right.has(value)) return true;
  }
  return false;
}

/**
 * Marks items that disagree with each other.
 * Does not add items and does not treat a missing source as a negative finding.
 */
export function markConflicts(
  items: ExpertEvidenceItem[],
): ExpertEvidenceItem[] {
  const licenses = items.filter((item) => item.category === 'license');
  const conflicting = new Set<ExpertEvidenceItem>();
  for (let i = 0; i < licenses.length; i++) {
    for (let j = i + 1; j < licenses.length; j++) {
      if (setsDiffer(stateSet(licenses[i]), stateSet(licenses[j]))) {
        conflicting.add(licenses[i]);
        conflicting.add(licenses[j]);
      }
    }
  }

  return items.map((item) => {
    const cvCount = item.raw?.cvCount;
    const indexedCount = item.raw?.indexedCount;
    const publicationGap =
      typeof cvCount === 'number' &&
      typeof indexedCount === 'number' &&
      cvCount !== indexedCount;
    if (conflicting.has(item) || publicationGap) {
      return { ...item, informationStatus: 'conflicting' as const };
    }
    return item;
  });
}
