/**
 * Disposable Phase A live check. Does not write investigations to the database.
 * Caps web search to Gemini grounding only. Uses a synthetic expert name.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { researchConfig } from '../src/config/research.config';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  ExpertResearchService,
} from '../src/integrations/expert-research/expert-research.service';
import { EwiPdfReportService } from '../src/modules/ewi/report/ewi-pdf-report.service';
import { EwiWordReportService } from '../src/modules/ewi/report/ewi-word-report.service';
import { prepareEwiReportInput } from '../src/modules/ewi/report/ewi-report-input';
import { EWI_WORKFLOW_STAGES } from '../src/modules/ewi/investigation/workflow/investigation-stages';
import { executeInvestigationWorkflow } from '../src/modules/ewi/investigation/workflow/investigation-workflow';
import { PdfReportRenderer } from '../src/platform/report/pdf/pdf-report.renderer';
import { DocxReportRenderer } from '../src/platform/report/docx/docx-report.renderer';
import { loadEnv } from './user-accounts';

const SECRET =
  /api[_-]?key|bearer\s+\S+|token=[^\s]+|AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z_-]+/gi;

function redact(value: string): string {
  return value.replace(SECRET, '[redacted]');
}

async function main() {
  loadEnv();
  process.env.WEB_SEARCH_PROVIDERS = 'gemini_grounding';
  process.env.WEB_SEARCH_MAX_QUERIES = '8';
  process.env.WEB_SEARCH_MAX_PAGES = '12';
  process.env.WEB_FETCH_MAX_PAGES = '6';
  process.env.WEB_RESEARCH_DEADLINE_MS = '120000';

  const settings = researchConfig();
  settings.mode = 'live';
  settings.web.providers = ['gemini_grounding'];
  settings.web.maxQueries = 8;
  settings.web.maxPages = 12;
  settings.web.maxFetchPages = 6;
  settings.web.deadlineMs = 120_000;
  settings.web.serperApiKey = undefined;
  settings.web.braveApiKey = undefined;
  settings.web.tavilyApiKey = undefined;

  const runtime = createExpertResearchRuntime(settings);
  if (!runtime.live?.webEngine) {
    throw new Error(
      'Live web engine was not created. RESEARCH_PROVIDER must be live.',
    );
  }
  const research = new ExpertResearchService(
    createCatalogProviders(runtime),
    null,
    runtime.live.webEngine,
  );
  const pdfReport = new EwiPdfReportService(new PdfReportRenderer());
  const wordReport = new EwiWordReportService(new DocxReportRenderer());
  const stages = EWI_WORKFLOW_STAGES.filter((stage) =>
    ['identify-expert', 'profiles', 'questions', 'report'].includes(stage.id),
  );

  const started = Date.now();
  const outcome = await executeInvestigationWorkflow(
    {
      expertName: 'Zelda Quill Testwitness',
      city: '',
      specialty: 'Neuropsychology',
    },
    { stages, research, report: pdfReport },
  );
  const elapsedMs = Date.now() - started;
  const prepared = prepareEwiReportInput(outcome.result);
  const pdf = await pdfReport.build(prepared);
  const word = await wordReport.build(prepared);

  const gemini = outcome.result.webResearch?.providers.find(
    (provider) => provider.providerId === 'gemini_grounding',
  );
  const coverage = (prepared.sourceStatuses ?? []).map((status) => ({
    sourceId: status.sourceId,
    coverage: status.coverage,
    checked: status.checked,
    status: status.status,
    outcome: status.outcome,
    itemCount: status.itemCount,
    retrievedAt: status.retrievedAt,
    message: redact(status.message ?? ''),
  }));
  const records = (outcome.result.webResearch?.records ?? [])
    .slice(0, 20)
    .map((record) => ({
      title: record.title,
      url: record.url,
      kind: record.kind,
      match: record.match.level,
      read: record.read,
      retrievedAt: record.retrievedAt,
    }));
  const webSearch = coverage.find((status) => status.sourceId === 'web_search');
  const summary = {
    elapsedMs,
    databaseWritten: false,
    expertName: outcome.result.expertName,
    templateVersion: pdf.templateVersion,
    questionCount: prepared.questions.length,
    storedQuestionCount: outcome.result.questions.length,
    evidenceCount: outcome.result.evidence.length,
    reportableEvidenceCount: prepared.evidence.filter(
      (item) => item.title !== 'Web research coverage',
    ).length,
    discrepancyCount: prepared.discrepancies.length,
    webSearchCoverage: webSearch?.coverage ?? null,
    webSearchOutcome: webSearch?.outcome ?? null,
    webTopics: (outcome.result.webResearch?.topics ?? []).map((topic) => ({
      topic: topic.topic,
      queries: topic.queries,
      hits: topic.hits,
    })),
    webEngineInvoked: Boolean(outcome.result.webResearch),
    gemini: gemini
      ? {
          configured: gemini.configured,
          requests: gemini.requests,
          hits: gemini.hits,
          failedRequests: gemini.failedRequests,
          failures: gemini.failures.map((failure) => ({
            kind: failure.kind,
            message: redact(failure.message),
          })),
        }
      : null,
    webQueriesRun: outcome.result.webResearch?.queriesRun ?? 0,
    webPagesRead: outcome.result.webResearch?.pagesRead ?? 0,
    webPagesBlocked: outcome.result.webResearch?.pagesBlocked?.length ?? 0,
    webLimitations: (outcome.result.webResearch?.limitations ?? []).map(redact),
    coverage,
    records,
    questions: prepared.questions.map((question) => question.question),
    pdfBytes: pdf.buffer.byteLength,
    wordBytes: word.buffer.byteLength,
  };

  const dir = mkdtempSync(join(tmpdir(), 'ewi-phase-a-'));
  const jsonPath = join(dir, 'validation.json');
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  writeFileSync(join(dir, pdf.fileName), pdf.buffer);
  writeFileSync(join(dir, word.fileName), word.buffer);
  console.log(
    JSON.stringify(
      { jsonPath, dir, ...summary, questions: summary.questions.slice(0, 8) },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? redact(error.message) : 'failed');
  process.exit(1);
});
