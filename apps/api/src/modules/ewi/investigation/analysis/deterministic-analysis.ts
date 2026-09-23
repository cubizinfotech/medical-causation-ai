import { EXPERT_RESEARCH_CATALOG } from '@integrations/expert-research';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertResearchSourceResult } from '@integrations/expert-research';
import { DiscrepancyAnalyzer } from '../../research/discrepancy-analyzer';
import type {
  AnalysisFinding,
  AnalysisPacket,
  AnalysisSourceAttempt,
  EwiAnalysisDocument,
  EwiAssessment,
} from './ewi-analysis.types';
import { EWI_ANALYSIS_SCHEMA_VERSION } from './ewi-analysis.types';

const CATEGORY_BY_PROVIDER = new Map(
  EXPERT_RESEARCH_CATALOG.map((provider) => [provider.id, provider.category]),
);

export function buildAnalysisPacket(input: {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  sourceResults: ExpertResearchSourceResult[];
}): AnalysisPacket {
  const findings: AnalysisFinding[] = input.evidence.map((item, index) => ({
    findingKey: `f${index + 1}`,
    category: item.category,
    title: item.title,
    summary: item.access === 'restricted' ? '' : item.summary,
    url: item.url,
    providerId: item.sourceId,
    informationStatus: item.informationStatus ?? 'unverified',
    access: item.access ?? 'public',
    raw: item.access === 'restricted' ? undefined : item.raw,
  }));

  const sourceAttempts: AnalysisSourceAttempt[] = input.sourceResults.map(
    (result) => ({
      sourceRef: `source:${result.sourceId}`,
      providerId: result.sourceId,
      category: CATEGORY_BY_PROVIDER.get(result.sourceId) ?? result.sourceId,
      status: result.status,
      access: result.access,
      message: result.message,
      itemCount: result.items.length,
    }),
  );

  return {
    expertName: input.expertName,
    specialty: input.specialty,
    findings,
    sourceAttempts,
  };
}

export function buildDeterministicAnalysis(
  packet: AnalysisPacket,
): EwiAnalysisDocument {
  const groups = groupFindings(packet.findings);
  const duplicates = findDuplicates(packet.findings);
  const comparisons = groups
    .filter((group) => group.findingKeys.length > 1)
    .map((group) => ({
      findingKeys: group.findingKeys,
      note: `Compared ${group.findingKeys.length} collected statements in ${group.category}. No statement was upgraded beyond its source status.`,
    }));
  const conflicts = packet.findings
    .filter((finding) => finding.informationStatus === 'conflicting')
    .map((finding) => ({
      findingKeys: [finding.findingKey],
      description: `Could not verify a single account. Collected statements disagree around "${finding.title}".`,
    }));
  const missing = missingCategories(packet);
  const cvDiscrepancies = cvGaps(packet);
  const assessments = packet.findings.map((finding) => ({
    findingKey: finding.findingKey,
    category: finding.category,
    assessment: assessFinding(finding),
    statement: assessmentStatement(finding),
    sourceRefs: [finding.findingKey],
  }));

  const summary = [
    `Investigation of ${packet.expertName} (${packet.specialty}).`,
    'This summary uses collected source statements only. It does not confirm a qualification that those statements do not support.',
    packet.findings.length === 0
      ? 'No research items were collected. The information could not be verified.'
      : `${packet.findings.length} item(s) were collected. Unverified and conflicting items could not be verified.`,
    ...missing.map((item) => item.note),
  ].join('\n');

  const conclusions = [
    ...assessments.map((assessment) => ({
      text: assessment.statement,
      sourceRefs: assessment.sourceRefs,
    })),
    ...missing.map((item) => ({
      text: item.note,
      sourceRefs: item.sourceRefs,
    })),
  ];

  const questions = [
    ...packet.findings.map((finding) => ({
      category: finding.category,
      question: `The collected record "${finding.title}" comes from ${finding.providerId}. What in that record supports the opinion you are offering?`,
      sourceRefs: [finding.findingKey],
    })),
    ...conflicts.map((conflict) => ({
      category: 'discrepancy',
      question: `Collected statements disagree: ${conflict.description} Which source should be relied on, and what was left out?`,
      sourceRefs: conflict.findingKeys,
    })),
  ];

  return {
    schemaVersion: EWI_ANALYSIS_SCHEMA_VERSION,
    groups,
    duplicates,
    comparisons,
    conflicts,
    missing,
    cvDiscrepancies,
    assessments,
    summary,
    conclusions,
    questions,
  };
}

function groupFindings(
  findings: AnalysisFinding[],
): EwiAnalysisDocument['groups'] {
  const groups = new Map<string, string[]>();
  for (const finding of findings) {
    const keys = groups.get(finding.category) ?? [];
    keys.push(finding.findingKey);
    groups.set(finding.category, keys);
  }
  return [...groups.entries()].map(([category, findingKeys]) => ({
    category,
    findingKeys,
  }));
}

function findDuplicates(
  findings: AnalysisFinding[],
): EwiAnalysisDocument['duplicates'] {
  const buckets = new Map<string, AnalysisFinding[]>();
  for (const finding of findings) {
    const titleKey = `title:${finding.title.trim().toLowerCase()}`;
    const urlKey = finding.url ? `url:${finding.url.trim().toLowerCase()}` : '';
    pushBucket(buckets, titleKey, finding);
    if (urlKey) pushBucket(buckets, urlKey, finding);
  }
  const seen = new Set<string>();
  const duplicates: EwiAnalysisDocument['duplicates'] = [];
  for (const [reason, items] of buckets) {
    const keys = [...new Set(items.map((item) => item.findingKey))];
    if (keys.length < 2) continue;
    const signature = keys.join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    duplicates.push({
      findingKeys: keys,
      reason: reason.startsWith('url:')
        ? 'Same source URL.'
        : 'Same collected title.',
    });
  }
  return duplicates;
}

function pushBucket(
  buckets: Map<string, AnalysisFinding[]>,
  key: string,
  finding: AnalysisFinding,
): void {
  const items = buckets.get(key) ?? [];
  items.push(finding);
  buckets.set(key, items);
}

function missingCategories(
  packet: AnalysisPacket,
): EwiAnalysisDocument['missing'] {
  const categoriesWithItems = new Set(
    packet.findings.map((finding) => finding.category),
  );
  const missing: EwiAnalysisDocument['missing'] = [];
  const seen = new Set<string>();
  for (const attempt of packet.sourceAttempts) {
    if (attempt.itemCount > 0 || categoriesWithItems.has(attempt.category)) {
      continue;
    }
    if (seen.has(attempt.category)) continue;
    seen.add(attempt.category);
    const unavailable =
      attempt.access === 'restricted' ||
      attempt.status === 'unavailable' ||
      attempt.status === 'error';
    missing.push({
      category: attempt.category,
      assessment: unavailable ? 'restricted_unavailable' : 'not_found',
      note: unavailable
        ? `Could not verify ${attempt.category}. ${attempt.providerId} requires authorized access or did not return a usable record. Nothing was inferred.`
        : `Could not verify ${attempt.category}. The searched source returned no record. That is not evidence the expert lacks this qualification.`,
      sourceRefs: [attempt.sourceRef],
    });
  }
  return missing;
}

function cvGaps(
  packet: AnalysisPacket,
): EwiAnalysisDocument['cvDiscrepancies'] {
  const analyzer = new DiscrepancyAnalyzer();
  const evidence = packet.findings.map((finding) => ({
    sourceId: finding.providerId,
    category: finding.category,
    title: finding.title,
    summary: finding.summary,
    url: finding.url,
    raw: finding.raw,
  }));
  return analyzer
    .analyze(evidence)
    .filter((item) => item.id !== 'review-recommended')
    .map((item) => ({
      findingKeys: packet.findings
        .filter((finding) => item.evidenceIds.includes(finding.title))
        .map((finding) => finding.findingKey),
      description: item.description,
    }))
    .filter((item) => item.findingKeys.length > 0);
}

function assessFinding(finding: AnalysisFinding): EwiAssessment {
  if (
    finding.access === 'restricted' ||
    finding.informationStatus === 'unavailable'
  ) {
    return 'restricted_unavailable';
  }
  if (finding.informationStatus === 'conflicting') return 'conflicting';
  if (finding.informationStatus === 'verified') return 'verified';
  return 'unverified';
}

function assessmentStatement(finding: AnalysisFinding): string {
  const assessment = assessFinding(finding);
  if (assessment === 'restricted_unavailable') {
    return `Could not verify "${finding.title}". ${finding.providerId} is restricted or unavailable. Content was not stored.`;
  }
  if (assessment === 'conflicting') {
    return `Could not verify "${finding.title}". Collected statements conflict.`;
  }
  if (assessment === 'verified') {
    return `The source ${finding.providerId} supports "${finding.title}".`;
  }
  return `Could not verify "${finding.title}". The ${finding.providerId} statement is unverified.`;
}
