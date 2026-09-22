import type { ExpertEvidenceItem } from '@integrations/expert-research';

export interface ExpertDiscrepancy {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  evidenceIds: string[];
  relatedUrls: string[];
}

/**
 * Deterministic discrepancy detection for v1 (no LLM required).
 */
export class DiscrepancyAnalyzer {
  analyze(items: ExpertEvidenceItem[]): ExpertDiscrepancy[] {
    const discrepancies: ExpertDiscrepancy[] = [];
    const licenses = items.filter((i) => i.category === 'license');
    const publications = items.filter((i) => i.category === 'publication');

    const activeLicense = licenses.find((i) => {
      const status =
        typeof i.raw?.status === 'string' ? i.raw.status.toLowerCase() : '';
      return status.includes('active');
    });
    const websiteClaim = licenses.find((i) =>
      i.title.toLowerCase().includes('website'),
    );

    if (activeLicense && websiteClaim) {
      const claimedStates = (websiteClaim.raw?.claimedStates as string[]) ?? [];
      const activeState =
        typeof activeLicense.raw?.state === 'string'
          ? activeLicense.raw.state
          : '';
      if (
        claimedStates.length > 0 &&
        activeState &&
        !claimedStates.includes(activeState)
      ) {
        discrepancies.push({
          id: 'license-state-mismatch',
          severity: 'high',
          title: 'License state mismatch',
          description: `Website claims licenses in ${claimedStates.join(', ')} but mock index shows ${activeState}.`,
          evidenceIds: [activeLicense.title, websiteClaim.title],
          relatedUrls: [activeLicense.url, websiteClaim.url].filter(
            (u): u is string => Boolean(u),
          ),
        });
      } else if (claimedStates.length > 1) {
        discrepancies.push({
          id: 'extra-license-claim',
          severity: 'medium',
          title: 'Additional license claimed on website',
          description: `Website claims ${claimedStates.join(', ')}; only ${activeState || 'one state'} verified in mock license source.`,
          evidenceIds: [activeLicense.title, websiteClaim.title],
          relatedUrls: [activeLicense.url, websiteClaim.url].filter(
            (u): u is string => Boolean(u),
          ),
        });
      }
    }

    const cvPub = publications.find((i) => i.raw?.cvCount != null);
    if (
      cvPub &&
      typeof cvPub.raw?.cvCount === 'number' &&
      typeof cvPub.raw?.indexedCount === 'number'
    ) {
      const gap = cvPub.raw.cvCount - cvPub.raw.indexedCount;
      if (gap > 0) {
        discrepancies.push({
          id: 'publication-count-gap',
          severity: 'medium',
          title: 'Publication count discrepancy',
          description: `CV lists ${cvPub.raw.cvCount} publications; indexed sources found ${cvPub.raw.indexedCount} (${gap} unaccounted).`,
          evidenceIds: [cvPub.title],
          relatedUrls: cvPub.url ? [cvPub.url] : [],
        });
      }
    }

    if (discrepancies.length === 0 && items.length > 0) {
      discrepancies.push({
        id: 'review-recommended',
        severity: 'low',
        title: 'Manual review recommended',
        description:
          'No hard conflicts detected in rule-based checks. Review collected evidence for consistency.',
        evidenceIds: items.slice(0, 3).map((i) => i.title),
        relatedUrls: items
          .map((i) => i.url)
          .filter((u): u is string => Boolean(u))
          .slice(0, 3),
      });
    }

    return discrepancies;
  }
}
