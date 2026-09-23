import { Logger } from '@nestjs/common';
import {
  markConflicts,
  type ExpertEvidenceItem,
  type ExpertResearchProviderId,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
} from '@integrations/expert-research';
import { DiscrepancyAnalyzer } from '../../research/discrepancy-analyzer';
import type { EwiWordReportService } from '../../report/ewi-word-report.service';
import { buildGroundedCrossExamQuestions } from '../../report/ewi-report-questions';
import {
  buildAnalysisPacket,
  buildDeterministicAnalysis,
} from '../analysis/deterministic-analysis';
import type {
  AnalysisPacket,
  EwiAnalysisRecord,
} from '../analysis/ewi-analysis.types';
import type {
  EwiInvestigationRequest,
  EwiInvestigationResult,
  EwiProgressUpdate,
} from '../jobs/ewi-investigation-job.types';
import {
  EWI_WORKFLOW_STAGES,
  type InvestigationStageDefinition,
} from './investigation-stages';
import {
  buildInvestigationSummary,
  type StageNote,
} from './investigation-summary';

const TRANSIENT_FAILURE =
  /timed out|rate limited|429|502|503|504|econnreset|temporarily/i;

const AUTHORIZED_ACCESS =
  'requires authorized access. No request was sent and restricted content was not stored.';

export interface InvestigationResearchPort {
  collectProviders(
    query: ExpertResearchQuery,
    providerIds: readonly ExpertResearchProviderId[],
  ): Promise<ExpertResearchSourceResult[]>;
}

export interface InvestigationWorkflowDependencies {
  research: InvestigationResearchPort;
  report: Pick<EwiWordReportService, 'build'>;
  analyze?: (packet: AnalysisPacket) => Promise<EwiAnalysisRecord>;
  onProgress?: (update: EwiProgressUpdate) => void | Promise<void>;
  logger?: Pick<Logger, 'log' | 'warn'>;
  stages?: readonly InvestigationStageDefinition[];
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface InvestigationWorkflowOutcome {
  result: EwiInvestigationResult;
  report: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    templateId?: string;
    templateVersion?: string;
  };
}

export function isTransientResearchFailure(
  result: ExpertResearchSourceResult,
): boolean {
  return (
    result.status === 'error' && TRANSIENT_FAILURE.test(result.message ?? '')
  );
}

export function describeResearchStage(
  stage: InvestigationStageDefinition,
  results: ExpertResearchSourceResult[],
): string {
  if (stage.providers.length === 0) {
    return 'No source is connected for this stage. Nothing was inferred.';
  }

  const parts: string[] = [];
  const restricted = results.filter(
    (result) =>
      result.access === 'restricted' || result.sourceId === 'lexisnexis',
  );
  if (restricted.length > 0) {
    const names = restricted.map((result) => result.sourceId).join(', ');
    parts.push(`${names} ${AUTHORIZED_ACCESS}`);
  }

  const failed = results.filter(
    (result) => result.status === 'error' && result.access !== 'restricted',
  );
  if (failed.length > 0) {
    parts.push(
      `${failed.length} source(s) failed (${failed
        .map((result) => result.message ?? result.sourceId)
        .join('; ')}). Continuing with the remaining stages.`,
    );
  }

  const unavailable = results.filter(
    (result) => result.status === 'unavailable',
  );
  if (unavailable.length > 0) {
    parts.push(
      `${unavailable.length} source(s) unavailable. No missing record was treated as a negative finding.`,
    );
  }

  const items = results.flatMap((result) => result.items);
  if (items.length === 0) {
    parts.push('No results.');
  } else {
    const conflicting = items.filter(
      (item) => item.informationStatus === 'conflicting',
    ).length;
    parts.push(
      `${items.length} item(s) collected${conflicting > 0 ? `, ${conflicting} conflicting` : ''}.`,
    );
  }

  return parts.join(' ');
}

export async function executeInvestigationWorkflow(
  request: EwiInvestigationRequest,
  dependencies: InvestigationWorkflowDependencies,
): Promise<InvestigationWorkflowOutcome> {
  const stages = dependencies.stages ?? EWI_WORKFLOW_STAGES;
  const logger = dependencies.logger;
  const maxAttempts = dependencies.maxAttempts ?? 3;
  const retryDelayMs = dependencies.retryDelayMs ?? 200;
  const sleep =
    dependencies.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const analyzer = new DiscrepancyAnalyzer();
  const stageNotes: StageNote[] = [];
  const sourceResults: ExpertResearchSourceResult[] = [];
  let evidence: ExpertEvidenceItem[] = [];
  let analysisRecord: EwiAnalysisRecord | undefined;

  const ensureAnalysis = async (): Promise<EwiAnalysisRecord> => {
    if (analysisRecord) return analysisRecord;
    const packet = buildAnalysisPacket({
      expertName: request.expertName,
      specialty: request.specialty,
      evidence,
      sourceResults,
    });
    analysisRecord = dependencies.analyze
      ? await dependencies.analyze(packet)
      : {
          origin: 'deterministic',
          providerName: null,
          document: buildDeterministicAnalysis(packet),
        };
    return analysisRecord;
  };

  for (let index = 0; index < stages.length; index++) {
    const stage = stages[index];
    const progress = Math.max(
      1,
      Math.round(((index + 1) / stages.length) * 100),
    );
    logger?.log(`EWI stage ${stage.id} started for ${request.expertName}`);

    if (stage.kind === 'identify') {
      const name = request.expertName?.trim() ?? '';
      const specialty = request.specialty?.trim() ?? '';
      if (name.length < 2 || specialty.length < 2) {
        throw new Error(
          'Expert name and medical specialty are required to start an investigation.',
        );
      }
      const message = `Identified ${name} (${specialty}). No additional identity facts were added.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      continue;
    }

    if (stage.kind === 'research') {
      const results = await runResearchStage(
        stage,
        request,
        dependencies,
        maxAttempts,
        retryDelayMs,
        sleep,
      );
      sourceResults.push(...results);
      evidence.push(...results.flatMap((result) => result.items));
      const message = describeResearchStage(stage, results);
      stageNotes.push({ label: stage.label, message });
      logger?.log(`EWI stage ${stage.id}: ${message}`);
      await report(dependencies, stage, progress, message);
      continue;
    }

    if (stage.kind === 'cross-check') {
      evidence = markConflicts(evidence);
      const conflicting = evidence.filter(
        (item) => item.informationStatus === 'conflicting',
      ).length;
      const message =
        conflicting > 0
          ? `${conflicting} collected item(s) disagree. No new records were created.`
          : 'No conflicts were found among collected items. No new records were created.';
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      continue;
    }

    if (stage.kind === 'discrepancy') {
      const discrepancies = analyzer.analyze(evidence);
      const message = `${discrepancies.length} discrepancy note(s) from collected items.`;
      stageNotes.push({ label: stage.label, message });
      await report(dependencies, stage, progress, message);
      continue;
    }

    if (stage.kind === 'summary') {
      const analysis = await ensureAnalysis();
      stageNotes.push({
        label: stage.label,
        message: `Summary ${analysis.origin === 'ai' ? 'phrased from collected findings' : 'built from collected findings only'}.`,
      });
      await report(
        dependencies,
        stage,
        progress,
        analysis.origin === 'ai'
          ? 'Summary phrased from collected findings. Source records were kept unchanged.'
          : 'Summary built from collected findings only.',
      );
      continue;
    }

    if (stage.kind === 'questions') {
      await report(
        dependencies,
        stage,
        progress,
        'Generating cross-examination questions from collected items…',
      );
      continue;
    }

    await report(dependencies, stage, progress, 'Building the Word report…');
  }

  const analysis = await ensureAnalysis();
  const summary =
    analysis.document.summary ||
    buildInvestigationSummary({
      expertName: request.expertName,
      specialty: request.specialty,
      evidence,
      stageNotes,
    });
  const discrepancies = [
    ...analysis.document.conflicts.map((item, index) => ({
      id: `conflict-${index + 1}`,
      severity: 'high' as const,
      title: 'Conflicting collected statements',
      description: item.description,
      evidenceIds: item.findingKeys,
      relatedUrls: urlsForKeys(evidence, analysis.document, item.findingKeys),
    })),
    ...analysis.document.cvDiscrepancies.map((item, index) => ({
      id: `cv-gap-${index + 1}`,
      severity: 'medium' as const,
      title: 'Collected statements disagree',
      description: item.description,
      evidenceIds: item.findingKeys,
      relatedUrls: urlsForKeys(evidence, analysis.document, item.findingKeys),
    })),
  ];
  const questions = buildGroundedCrossExamQuestions({
    expertName: request.expertName,
    evidence,
    discrepancies,
  });
  const generatedAt = new Date().toISOString();
  const reportArtifact = await dependencies.report.build({
    expertName: request.expertName,
    specialty: request.specialty,
    evidence,
    discrepancies,
    questions,
    generatedAt,
    summary,
    analysis: analysis.document,
  });

  const result: EwiInvestigationResult = {
    expertName: request.expertName,
    specialty: request.specialty,
    evidence,
    discrepancies,
    questions,
    questionCount: questions.length,
    summary,
    analysis,
    sourceStatuses: sourceResults.map((resultItem) => ({
      sourceId: resultItem.sourceId,
      status: resultItem.status,
      message: resultItem.message,
      itemCount: resultItem.items.length,
    })),
    reportFileName: reportArtifact.fileName,
    generatedAt,
    disclaimer:
      'Expert Witness Investigation output is for attorney research only. Unavailable sources are not evidence that a credential is absent. Development fixtures are unverified.',
  };

  logger?.log(
    `EWI workflow finished for ${request.expertName}: ${evidence.length} items, ${questions.length} questions`,
  );

  return {
    result,
    report: {
      fileName: reportArtifact.fileName,
      mimeType: reportArtifact.mimeType,
      buffer: reportArtifact.buffer,
      templateId: reportArtifact.templateId,
      templateVersion: reportArtifact.templateVersion,
    },
  };
}

async function runResearchStage(
  stage: InvestigationStageDefinition,
  request: EwiInvestigationRequest,
  dependencies: InvestigationWorkflowDependencies,
  maxAttempts: number,
  retryDelayMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<ExpertResearchSourceResult[]> {
  if (stage.providers.length === 0) return [];

  const pending = new Set(stage.providers);
  const finished = new Map<string, ExpertResearchSourceResult>();

  for (let attempt = 1; attempt <= maxAttempts && pending.size > 0; attempt++) {
    let batch: ExpertResearchSourceResult[];
    try {
      batch = await dependencies.research.collectProviders(request, [
        ...pending,
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Research stage failed';
      dependencies.logger?.warn(
        `EWI stage ${stage.id} attempt ${attempt} failed: ${message}`,
      );
      if (attempt >= maxAttempts) {
        return [...pending].map((sourceId) => failedResult(sourceId, message));
      }
      await sleep(retryDelayMs * attempt);
      continue;
    }

    for (const result of batch) {
      if (isTransientResearchFailure(result) && attempt < maxAttempts) {
        continue;
      }
      finished.set(result.sourceId, result);
      pending.delete(result.sourceId);
    }

    if (pending.size > 0 && attempt < maxAttempts) {
      dependencies.logger?.warn(
        `EWI stage ${stage.id} retrying ${[...pending].join(', ')} after a transient failure`,
      );
      await sleep(retryDelayMs * attempt);
    }
  }

  return stage.providers.map(
    (sourceId) =>
      finished.get(sourceId) ??
      failedResult(sourceId, 'Source did not return a result.'),
  );
}

function urlsForKeys(
  evidence: ExpertEvidenceItem[],
  document: EwiAnalysisRecord['document'],
  findingKeys: string[],
): string[] {
  const keyToIndex = new Map(
    document.assessments.map((assessment) => [
      assessment.findingKey,
      Number(assessment.findingKey.replace('f', '')) - 1,
    ]),
  );
  return findingKeys
    .map((key) => evidence[keyToIndex.get(key) ?? -1]?.url)
    .filter((url): url is string => Boolean(url));
}

function failedResult(
  sourceId: ExpertResearchProviderId,
  message: string,
): ExpertResearchSourceResult {
  return {
    sourceId,
    status: 'error',
    access: sourceId === 'lexisnexis' ? 'restricted' : 'unavailable',
    message,
    retrievedAt: new Date().toISOString(),
    items: [],
  };
}

async function report(
  dependencies: InvestigationWorkflowDependencies,
  stage: InvestigationStageDefinition,
  progress: number,
  message: string,
): Promise<void> {
  await dependencies.onProgress?.({
    step: stage.id,
    stepLabel: stage.label,
    progress,
    message,
  });
}
