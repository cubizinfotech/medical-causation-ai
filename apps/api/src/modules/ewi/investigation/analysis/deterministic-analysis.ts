import { EXPERT_RESEARCH_CATALOG } from '@integrations/expert-research';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertResearchSourceResult } from '@integrations/expert-research';
import { DiscrepancyAnalyzer } from '../../research/discrepancy-analyzer';
import type {
  AnalysisFinding,
  AnalysisPacket,
  AnalysisSourceAttempt,
  EwiAnalysisDocument,
  EwiAnalysisQuestion,
  EwiAnalysisSectionId,
  EwiAnalysisSectionSummary,
  EwiAssessment,
} from './ewi-analysis.types';
import {
  EWI_ANALYSIS_SCHEMA_VERSION,
  EWI_ANALYSIS_SECTIONS,
  MIN_LEADING_QUESTIONS,
  SECTION_CATEGORY_MAP,
} from './ewi-analysis.types';

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
    sourceRefs: [finding.findingKey, ...(finding.url ? [finding.url] : [])],
  }));

  const sectionSummaries = buildSectionSummaries(packet, conflicts, missing);
  const investigationFindings = assessments.map((item) => ({
    text: item.statement,
    status: item.assessment,
    sourceRefs: item.sourceRefs,
  }));

  const summary = [
    `Investigation of ${packet.expertName} (${packet.specialty}).`,
    'This summary uses collected source statements only. It does not confirm a qualification that those statements do not support.',
    packet.findings.length === 0
      ? 'No research items were collected. The information could not be verified.'
      : `${packet.findings.length} item(s) were collected. Not verified and conflicting items could not be verified.`,
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

  const questions = buildLeadingQuestions(packet, conflicts);

  return {
    schemaVersion: EWI_ANALYSIS_SCHEMA_VERSION,
    groups,
    duplicates,
    comparisons,
    conflicts,
    missing,
    cvDiscrepancies,
    assessments,
    sectionSummaries,
    investigationFindings,
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

    if (attempt.access === 'restricted') {
      missing.push({
        category: attempt.category,
        assessment: 'restricted',
        note: `Could not verify ${attempt.category}. ${attempt.providerId} requires authorized access. Nothing was inferred.`,
        sourceRefs: [attempt.sourceRef],
      });
      continue;
    }

    if (attempt.status === 'unavailable' || attempt.status === 'error') {
      missing.push({
        category: attempt.category,
        assessment: 'unavailable',
        note: `Could not verify ${attempt.category}. ${attempt.providerId} did not return a usable record. Nothing was inferred.`,
        sourceRefs: [attempt.sourceRef],
      });
      continue;
    }

    missing.push({
      category: attempt.category,
      assessment: 'not_found',
      note: `Could not verify ${attempt.category}. The searched source returned no record. That is not evidence the expert lacks this qualification.`,
      sourceRefs: [attempt.sourceRef],
    });
  }
  return missing;
}

function cvGaps(
  packet: AnalysisPacket,
): EwiAnalysisDocument['cvDiscrepancies'] {
  const evidence = packet.findings.map((finding) => ({
    sourceId: finding.providerId,
    category: finding.category,
    title: finding.title,
    summary: finding.summary,
    url: finding.url,
    raw: finding.raw,
  }));
  return new DiscrepancyAnalyzer()
    .analyze(
      evidence,
      packet.sourceAttempts.map((attempt) => ({
        providerId: attempt.providerId,
        status: attempt.status,
        access: attempt.access,
        itemCount: attempt.itemCount,
      })),
    )
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
  if (finding.access === 'restricted') return 'restricted';
  if (finding.informationStatus === 'unavailable') return 'unavailable';
  if (finding.informationStatus === 'conflicting') return 'conflicting';
  if (finding.informationStatus === 'verified') return 'verified';
  if (
    finding.informationStatus === 'partial' ||
    finding.informationStatus === 'partially_verified'
  ) {
    return 'partially_verified';
  }
  if (
    finding.informationStatus === 'not_found' ||
    finding.informationStatus === 'not found'
  ) {
    return 'not_found';
  }
  // Legacy provider status "unverified" maps to Not Verified.
  return 'not_verified';
}

function assessmentStatement(finding: AnalysisFinding): string {
  const assessment = assessFinding(finding);
  if (assessment === 'restricted') {
    return `Could not verify "${finding.title}". ${finding.providerId} is restricted. Content was not stored.`;
  }
  if (assessment === 'unavailable') {
    return `Could not verify "${finding.title}". ${finding.providerId} is unavailable. Content was not stored.`;
  }
  if (assessment === 'conflicting') {
    return `Could not verify "${finding.title}". Collected statements conflict.`;
  }
  if (assessment === 'verified') {
    return `The source ${finding.providerId} supports "${finding.title}".`;
  }
  if (assessment === 'partially_verified') {
    return `Only partially verified for "${finding.title}" from ${finding.providerId}.`;
  }
  if (assessment === 'not_found') {
    return `Could not verify "${finding.title}". No matching record was found.`;
  }
  return `Could not verify "${finding.title}". The ${finding.providerId} statement is not verified.`;
}

function findingsForCategories(
  packet: AnalysisPacket,
  categories: readonly string[],
): AnalysisFinding[] {
  if (categories.length === 0) return [];
  const set = new Set(categories.map((c) => c.toLowerCase()));
  return packet.findings.filter((f) => set.has(f.category.toLowerCase()));
}

function attemptsForCategories(
  packet: AnalysisPacket,
  categories: readonly string[],
): AnalysisSourceAttempt[] {
  if (categories.length === 0) return [];
  const set = new Set(categories.map((c) => c.toLowerCase()));
  return packet.sourceAttempts.filter((s) => set.has(s.category.toLowerCase()));
}

function sectionStatus(
  findings: AnalysisFinding[],
  attempts: AnalysisSourceAttempt[],
): EwiAssessment {
  if (findings.length === 0) {
    if (attempts.some((a) => a.access === 'restricted')) return 'restricted';
    if (
      attempts.some((a) => a.status === 'unavailable' || a.status === 'error')
    ) {
      return 'unavailable';
    }
    return 'not_found';
  }
  const labels = findings.map(assessFinding);
  if (labels.includes('conflicting')) return 'conflicting';
  if (labels.every((l) => l === 'verified')) return 'verified';
  if (labels.some((l) => l === 'partially_verified' || l === 'verified')) {
    return 'partially_verified';
  }
  if (labels.some((l) => l === 'restricted')) return 'restricted';
  if (labels.some((l) => l === 'unavailable')) return 'unavailable';
  return 'not_verified';
}

function sectionNarrative(
  section: EwiAnalysisSectionId,
  packet: AnalysisPacket,
  findings: AnalysisFinding[],
  status: EwiAssessment,
): string {
  const titles = findings
    .map((f) => f.title)
    .filter(Boolean)
    .slice(0, 8);
  switch (section) {
    case 'expert_summary':
      return findings.length
        ? `Collected identity/background for ${packet.expertName} (${packet.specialty}): ${titles.join('; ')}.`
        : `No verified identity profile findings were collected for ${packet.expertName}. Status: ${status}.`;
    case 'credentials':
      return findings.length
        ? `Credential findings: ${titles.join('; ')}.`
        : `No education, license, or board certification findings were collected. Status: ${status}.`;
    case 'cv_comparison':
      return findings.length >= 2
        ? `Multiple CV/profile records collected (${findings.length}). Compare only cited finding keys.`
        : findings.length === 1
          ? 'A single CV/profile record was collected; multi-version comparison is not available from this packet.'
          : `No CV findings were collected for comparison. Status: ${status}.`;
    case 'inconsistencies':
      return 'Inconsistencies are listed only when conflicting assessments appear in the packet; none are invented.';
    case 'legal_matters':
      return findings.length
        ? `Legal matter findings: ${titles.join('; ')}.`
        : `No legal matter findings were collected. Status: ${status}.`;
    case 'orders':
      return findings.length
        ? `Court order findings: ${titles.join('; ')}.`
        : `No court order findings were collected. Status: ${status}.`;
    case 'motions':
      return findings.length
        ? `Motion findings: ${titles.join('; ')}.`
        : `No motion findings were collected. Status: ${status}.`;
    case 'depositions':
      return findings.length
        ? `Deposition findings: ${titles.join('; ')}.`
        : `No deposition findings were collected. Status: ${status}.`;
    case 'contradictory_testimony':
      return findings.length
        ? `Testimony-related findings: ${titles.join('; ')}. Contradictions require conflicting packet assessments.`
        : `No testimony findings were collected; contradictory testimony cannot be asserted. Status: ${status}.`;
    case 'publications':
      return findings.length
        ? `Publication findings: ${titles.join('; ')}.`
        : `No publication findings were collected. Status: ${status}.`;
    case 'authorship':
      return findings.length
        ? `Authorship notes are limited to publication findings in the packet (${findings.length} item(s)).`
        : `No publication findings were collected; authorship discrepancies cannot be asserted. Status: ${status}.`;
    case 'grants_patents':
      return findings.length
        ? `Grant/patent findings: ${titles.join('; ')}.`
        : `No grant or patent findings were collected. Status: ${status}.`;
    case 'licenses_certifications':
      return findings.length
        ? `License/certification findings: ${titles.join('; ')}.`
        : `No license or certification findings were collected. Status: ${status}.`;
    case 'memberships':
      return findings.length
        ? `Membership findings: ${titles.join('; ')}.`
        : `No membership findings were collected. Status: ${status}.`;
    case 'websites':
      return findings.length
        ? `Website/directory findings: ${titles.join('; ')}.`
        : `No website findings were collected. Status: ${status}.`;
    case 'videos':
      return findings.length
        ? `Video/presentation findings: ${titles.join('; ')}.`
        : `No video findings were collected. Status: ${status}.`;
    case 'social_media':
      return findings.length
        ? `Social media findings: ${titles.join('; ')}.`
        : `No social media findings were collected. Status: ${status}.`;
    case 'income_bias':
      return findings.length
        ? `Income/bias-related findings: ${titles.join('; ')}.`
        : `No income or bias findings were collected. Status: ${status}.`;
    case 'university_rules':
      return findings.length
        ? `University rule findings: ${titles.join('; ')}.`
        : `No university rule findings were collected. Status: ${status}.`;
    case 'missing_unverified':
      return 'See missing[] and assessments for packet-grounded gaps. Absent evidence is not proof of unqualified status.';
    case 'investigation_findings':
      return packet.findings.length
        ? `Investigation findings are limited to ${packet.findings.length} collected finding key(s).`
        : 'No findings were collected; investigation findings cannot be asserted.';
    default:
      return `No packet-supported summary. Status: ${status}.`;
  }
}

function buildSectionSummaries(
  packet: AnalysisPacket,
  conflicts: EwiAnalysisDocument['conflicts'],
  missing: EwiAnalysisDocument['missing'],
): EwiAnalysisSectionSummary[] {
  return EWI_ANALYSIS_SECTIONS.map((section) => {
    const categories = SECTION_CATEGORY_MAP[section];

    if (section === 'inconsistencies') {
      const findingKeys = conflicts.flatMap((c) => c.findingKeys);
      return {
        section,
        text: sectionNarrative(
          section,
          packet,
          [],
          findingKeys.length ? 'conflicting' : 'not_found',
        ),
        status: findingKeys.length ? 'conflicting' : 'not_found',
        sourceRefs: findingKeys,
        findingKeys,
      };
    }

    if (section === 'missing_unverified') {
      return {
        section,
        text: sectionNarrative(section, packet, [], 'not_verified'),
        status: 'not_verified',
        sourceRefs: missing.flatMap((m) => m.sourceRefs),
        findingKeys: packet.findings
          .filter((f) => assessFinding(f) === 'not_verified')
          .map((f) => f.findingKey),
      };
    }

    if (section === 'investigation_findings') {
      return {
        section,
        text: sectionNarrative(
          section,
          packet,
          packet.findings,
          packet.findings.length ? 'partially_verified' : 'not_found',
        ),
        status: packet.findings.length ? 'partially_verified' : 'not_found',
        sourceRefs: [
          ...packet.findings.map((f) => f.findingKey),
          ...packet.sourceAttempts.map((s) => s.sourceRef),
        ].slice(0, 40),
        findingKeys: packet.findings.map((f) => f.findingKey),
      };
    }

    const findings = findingsForCategories(packet, categories);
    const attempts = attemptsForCategories(packet, categories);
    const status = sectionStatus(findings, attempts);
    return {
      section,
      text: sectionNarrative(section, packet, findings, status),
      status,
      sourceRefs: [
        ...findings.map((f) => f.findingKey),
        ...findings.map((f) => f.url).filter((u): u is string => Boolean(u)),
        ...attempts.map((a) => a.sourceRef),
      ].slice(0, 40),
      findingKeys: findings.map((f) => f.findingKey),
    };
  });
}

function isWeakFinding(finding: AnalysisFinding): boolean {
  const status = assessFinding(finding);
  return (
    status === 'not_verified' ||
    status === 'partially_verified' ||
    status === 'conflicting' ||
    status === 'unavailable' ||
    status === 'restricted' ||
    status === 'not_found'
  );
}

/**
 * Build ≥100 leading questions grounded only in collected findings/source attempts.
 */
export function buildLeadingQuestions(
  packet: AnalysisPacket,
  conflicts: EwiAnalysisDocument['conflicts'] = [],
): EwiAnalysisQuestion[] {
  const questions: EwiAnalysisQuestion[] = [];

  const findingTemplates: Array<
    (finding: AnalysisFinding) => Omit<EwiAnalysisQuestion, 'uncertaintyNote'>
  > = [
    (f) => ({
      category: f.category,
      question: `The collected record "${f.title}" comes from ${f.providerId}. What in that record supports the opinion you are offering?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `Is the ${f.category} information in finding ${f.findingKey} complete and current?`,
      sourceRefs: [f.findingKey, ...(f.url ? [f.url] : [])],
    }),
    (f) => ({
      category: f.category,
      question: `What independent documentation confirms "${f.title}" beyond ${f.providerId}?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `Were any material facts omitted from the ${f.category} record associated with ${f.findingKey}?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `How should counsel weigh the reliability of ${f.category} evidence from ${f.findingKey}?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `Does finding ${f.findingKey} conflict with any other collected ${f.category} statement in this investigation?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `Has any later ${f.category} disclosure superseded the information in ${f.findingKey}?`,
      sourceRefs: [f.findingKey],
    }),
    (f) => ({
      category: f.category,
      question: `What dates, titles, or identifiers in "${f.title}" can you authenticate from primary records?`,
      sourceRefs: [f.findingKey, ...(f.url ? [f.url] : [])],
    }),
  ];

  for (const finding of packet.findings) {
    for (const template of findingTemplates) {
      const base = template(finding);
      questions.push({
        ...base,
        ...(isWeakFinding(finding)
          ? {
              uncertaintyNote:
                'Evidence for this item is weak, conflicting, restricted, or not verified; treat confirmation as open.',
            }
          : {}),
      });
    }
    if (finding.url) {
      questions.push({
        category: finding.category,
        question: `Does the source at the cited URL accurately reflect the expert's ${finding.category} claims in ${finding.findingKey}?`,
        sourceRefs: [finding.findingKey, finding.url],
        ...(isWeakFinding(finding)
          ? {
              uncertaintyNote:
                'Packet assessment is not fully verified; question reflects that uncertainty.',
            }
          : {}),
      });
    }
  }

  for (const conflict of conflicts) {
    questions.push({
      category: 'discrepancy',
      question: `Collected statements disagree: ${conflict.description} Which source should be relied on, and what was left out?`,
      sourceRefs: conflict.findingKeys,
      uncertaintyNote:
        'Conflicting evidence; do not treat either account as settled.',
    });
  }

  for (const attempt of packet.sourceAttempts) {
    if (attempt.itemCount > 0) continue;
    const uncertainty =
      attempt.access === 'restricted'
        ? 'Source is restricted; absence of items does not prove the underlying fact.'
        : attempt.status === 'unavailable' || attempt.status === 'error'
          ? 'Source was unavailable; the question must not assume a negative finding.'
          : 'No items were returned; treat as not found rather than disproven.';

    questions.push(
      {
        category: attempt.category,
        question: `Why was no ${attempt.category} evidence retrieved from ${attempt.sourceRef}, and what alternate documentation exists?`,
        sourceRefs: [attempt.sourceRef],
        uncertaintyNote: uncertainty,
      },
      {
        category: attempt.category,
        question: `What authorized process, if any, is required to obtain ${attempt.category} records beyond ${attempt.sourceRef}?`,
        sourceRefs: [attempt.sourceRef],
        uncertaintyNote: uncertainty,
      },
      {
        category: attempt.category,
        question: `If ${attempt.category} materials later appear, how should they be reconciled with the empty result from ${attempt.sourceRef}?`,
        sourceRefs: [attempt.sourceRef],
        uncertaintyNote: uncertainty,
      },
    );
  }

  // Expand to ≥100 using only packet-grounded stems.
  const stems = [
    (cat: string, key: string) =>
      `What corroborating record supports the ${cat} claim linked to ${key}?`,
    (cat: string, key: string) =>
      `What would falsify the ${cat} claim associated with ${key}?`,
    (cat: string, key: string) =>
      `Who created or maintained the ${cat} record cited as ${key}?`,
    (cat: string, key: string) =>
      `What time period does the ${cat} evidence in ${key} actually cover?`,
    (cat: string, key: string) =>
      `Are there related ${cat} disclosures that counsel should request beyond ${key}?`,
  ];

  let i = 0;
  while (
    questions.length < MIN_LEADING_QUESTIONS &&
    (packet.findings.length > 0 || packet.sourceAttempts.length > 0)
  ) {
    if (packet.findings.length > 0) {
      const f = packet.findings[i % packet.findings.length];
      const stem = stems[i % stems.length];
      questions.push({
        category: f.category,
        question: stem(f.category, f.findingKey),
        sourceRefs: [f.findingKey, ...(f.url ? [f.url] : [])],
        ...(isWeakFinding(f)
          ? {
              uncertaintyNote:
                'Evidence is limited; the question reflects uncertainty rather than a proven fact.',
            }
          : {}),
      });
    } else {
      const a = packet.sourceAttempts[i % packet.sourceAttempts.length];
      questions.push({
        category: a.category,
        question: `What additional ${a.category} sources should be checked beyond ${a.sourceRef}?`,
        sourceRefs: [a.sourceRef],
        uncertaintyNote:
          'Prior attempt returned no items; additional inquiry is warranted.',
      });
    }
    i += 1;
    if (i > 2000) break;
  }

  return questions;
}
