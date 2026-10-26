/**
 * Local Phase 1.1 check: full investigation + PDF, no database write.
 * Does not change .env files. Forces live adapters for this process only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGeminiClient } from '../src/ai/utils/gemini-client.util';
import { researchConfig } from '../src/config/research.config';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  createPublicationLookup,
  ExpertResearchService,
} from '../src/integrations/expert-research/expert-research.service';
import { finalizeCvClaims } from '../src/modules/ewi/cv/cv-claims';
import type { CvExtraction } from '../src/modules/ewi/cv/cv.types';
import { PdfParser } from '../src/modules/document-processing/parsers/pdf.parser';
import { EWI_WORKFLOW_STAGES } from '../src/modules/ewi/investigation/workflow/investigation-stages';
import { executeInvestigationWorkflow } from '../src/modules/ewi/investigation/workflow/investigation-workflow';
import { prepareEwiReportInput } from '../src/modules/ewi/report/ewi-report-input';
import { EwiPdfReportService } from '../src/modules/ewi/report/ewi-pdf-report.service';
import { buildEwiReportDocument } from '../src/modules/ewi/report/ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from '../src/modules/ewi/report/ewi-report.version';
import { PdfReportRenderer } from '../src/platform/report/pdf/pdf-report.renderer';
import type { WebResearchLlm } from '../src/integrations/web-research/web-research.types';
import { loadEnv } from './user-accounts';

const SECRET =
  /api[_-]?key|bearer\s+\S+|token=[^\s]+|AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z_-]+/gi;

function redact(value: string): string {
  return value.replace(SECRET, '[redacted]');
}

function makeLlm(
  apiKey: string | undefined,
  model: string,
): WebResearchLlm | undefined {
  if (!apiKey) return undefined;
  return async ({ system, user, maxTokens }) => {
    const ai = createGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      config: {
        systemInstruction: system,
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    });
    return response.text ?? '';
  };
}

function vitaExtraction(vita: string): CvExtraction {
  const claims = finalizeCvClaims([
    {
      category: 'education',
      statement:
        'M.A. in Clinical Adult Psychology; December, 1996 Southern Illinois University, Edwardsville, Illinois',
      details: {
        degree: 'M.A.',
        institution: 'Southern Illinois University',
        year: '1996',
      },
      page: 1,
      quote: 'M.A. in Clinical Adult Psychology; December, 1996',
    },
    {
      category: 'education',
      statement:
        'B.A. in Psychology; May, 1995 University of West Florida, Pensacola, Florida',
      details: {
        degree: 'B.A.',
        institution: 'University of West Florida',
        year: '1995',
      },
      page: 1,
      quote: 'B.A. in Psychology; May, 1995',
    },
    {
      category: 'publication',
      statement:
        'Hanlon, R.E., Mattson, D., Demery, J.A., & Dromerick, A.W. (1998). Axial movements are relatively preserved with respect to limb movements in aphasic patients. Cortex, 34 (5), 731- 741.',
      details: {
        title:
          'Axial movements are relatively preserved with respect to limb movements in aphasic patients',
        journal: 'Cortex',
        year: '1998',
        publicationType: 'article',
      },
      page: 1,
      quote:
        'Axial movements are relatively preserved with respect to limb movements in aphasic patients',
    },
    {
      category: 'publication',
      statement:
        'Demery, J.A., Duchek, J.M., & Hanlon, R.E. (1999). Verbal learning following mild traumatic brain injury [Abstract]. Journal of the International Neuropsychological Society, 5 (2), 139.',
      details: {
        title: 'Verbal learning following mild traumatic brain injury',
        journal: 'Journal of the International Neuropsychological Society',
        year: '1999',
        publicationType: 'abstract',
      },
      page: 1,
      quote:
        'Verbal learning following mild traumatic brain injury [Abstract]',
    },
    {
      category: 'award',
      statement:
        '1998 Dean of the College of Health Professions Research Scholarship Award',
      details: {
        title: 'Dean of the College of Health Professions Research Scholarship Award',
        year: '1998',
      },
      page: 1,
      quote: 'Dean of the College of Health Professions Research Scholarship Award',
    },
    {
      category: 'appointment',
      statement:
        '8/92-8/95 Signals Intelligence Instructor. United States Marine Corps, Naval Technical Training Command, Pensacola, FL.',
      details: {
        title: 'Signals Intelligence Instructor',
        institution: 'United States Marine Corps',
        year: '1992',
      },
      page: 1,
      quote: 'Signals Intelligence Instructor. United States Marine Corps',
    },
  ]);
  return {
    document: {
      id: 'vita-html',
      name: 'demeryvita.html',
      pageCount: 1,
      unreadablePages: [],
      ocrPages: [],
    },
    status: 'completed',
    claims,
    warnings: [
      'Public University of Florida faculty vita used as a development CV. It is a student-era document, not a current professional CV.',
      vita.includes('Marine Corps')
        ? 'Vita text includes United States Marine Corps service.'
        : 'Vita text did not include Marine Corps after fetch.',
    ],
  };
}

async function loadVita(): Promise<string> {
  const response = await fetch('https://users.phhp.ufl.edu/rbauer/demeryvita.html');
  if (!response.ok) {
    throw new Error(`Vita fetch failed: HTTP ${response.status}`);
  }
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  loadEnv();
  process.env.RESEARCH_PROVIDER = 'live';
  const settings = researchConfig();
  settings.mode = 'live';
  const model =
    process.env.GEMINI_LLM_MODEL?.trim() || 'gemini-2.5-flash';
  const llm = makeLlm(settings.web.geminiApiKey, model);
  const runtime = createExpertResearchRuntime(settings, { webLlm: llm });
  if (!runtime.live?.webEngine) {
    throw new Error('Live web engine was not created.');
  }
  const research = new ExpertResearchService(
    createCatalogProviders(runtime),
    createPublicationLookup(runtime),
    runtime.live.webEngine,
  );
  const vita = await loadVita();
  const extraction = vitaExtraction(vita);
  const pdfReport = new EwiPdfReportService(new PdfReportRenderer());
  const started = Date.now();
  const outcome = await executeInvestigationWorkflow(
    {
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
      cvDocumentId: 'vita-html',
    },
    {
      stages: EWI_WORKFLOW_STAGES,
      research,
      report: pdfReport,
      readCv: async () => extraction,
    },
  );
  const elapsedMs = Date.now() - started;
  const prepared = prepareEwiReportInput(outcome.result);
  const modelDoc = buildEwiReportDocument(prepared);
  const pdf = await pdfReport.build(prepared);
  const parsed = await new PdfParser().parse({
    filePath: 'phase-1-dev.pdf',
    buffer: pdf.buffer,
    filename: 'phase-1-dev.pdf',
    extension: 'pdf',
    fileSize: pdf.buffer.byteLength,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });
  const pdfText = parsed.pages.map((page) => page.text).join('\n\n');
  const section = (id: string) =>
    modelDoc.sections
      .find((entry) => entry.id === id)
      ?.blocks.map((block) => block.text)
      .join('\n') ?? '';
  const dir = join(tmpdir(), 'ewi-phase-1-dev');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, pdf.fileName), pdf.buffer);
  writeFileSync(join(dir, 'report.txt'), pdfText);
  const wanted = [
    'patents',
    'directories',
    'ime',
    'awards-military',
    'videos',
    'publications',
    'cv-comparison',
    'grants',
    'depositions',
    'criminal',
    'education',
    'memberships',
    'university-accreditation',
    'office-location',
    'overall-findings',
    'web-research',
  ];
  const sections: Record<string, string> = {};
  for (const id of wanted) sections[id] = section(id);
  const summary = {
    elapsedMs,
    databaseWritten: false,
    templateVersionCode: EWI_REPORT_TEMPLATE_VERSION,
    templateVersionPdf: pdf.templateVersion,
    templateVersionModel: modelDoc.templateVersion,
    pdfHas3102: /3\.10\.2/.test(pdfText),
    pdfHas3101: /3\.10\.1/.test(pdfText),
    pdfFile: join(dir, pdf.fileName),
    expertName: outcome.result.expertName,
    evidenceCount: outcome.result.evidence.length,
    questionCount: prepared.questions.length,
    cvComparisons: (outcome.result.cvCheck?.comparisons ?? []).map((row) => ({
      topic: row.topic,
      label: row.label,
      title: row.title,
      cv: row.cv?.statement,
      source: row.source?.statement,
      url: row.source?.url,
      note: row.note,
    })),
    sourceStatuses: (prepared.sourceStatuses ?? []).map((status) => ({
      sourceId: status.sourceId,
      coverage: status.coverage,
      status: status.status,
      outcome: status.outcome,
      itemCount: status.itemCount,
      message: redact(status.message ?? ''),
    })),
    webTopics: (outcome.result.webResearch?.topics ?? []).map((topic) => ({
      topic: topic.topic,
      queries: topic.queries,
      hits: topic.hits,
    })),
    omittedTopics: outcome.result.webResearch?.omittedTopics ?? [],
    serper: outcome.result.webResearch?.providers.find(
      (provider) => provider.providerId === 'serper',
    ),
    pdfSnippets: {
      versionLine: pdfText.match(/Report 3\.10\.\d/)?.[0] ?? null,
      notImplemented: [...pdfText.matchAll(/[^\n]{0,80}not implemented[^\n]{0,80}/gi)]
        .slice(0, 12)
        .map((match) => match[0]),
    },
    sections,
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        pdfFile: summary.pdfFile,
        summaryFile: join(dir, 'summary.json'),
        txtFile: join(dir, 'report.txt'),
        templateVersionPdf: summary.templateVersionPdf,
        pdfHas3102: summary.pdfHas3102,
        elapsedMs: summary.elapsedMs,
        evidenceCount: summary.evidenceCount,
        cvComparisons: summary.cvComparisons.length,
        omittedTopics: summary.omittedTopics,
        pdfSnippets: summary.pdfSnippets,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? redact(error.message) : error);
  process.exit(1);
});
