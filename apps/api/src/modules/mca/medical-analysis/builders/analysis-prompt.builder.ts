import { Injectable } from '@nestjs/common';
import type { RetrievalResult } from '@modules/rag/types';
import type {
  MedicalAnalysisRequest,
  BuiltAnalysisPrompts,
  AnalysisCitation,
  DefenseIssuesSummary,
  MedicalChronology,
} from '../types';
import { MedicalPromptService } from '../prompts';
import {
  formatChronologyForPrompt,
  recordCitationText,
} from '../records/chronology.helpers';
import { MedicalQueryBuilder } from './medical-query.builder';

const DEFAULT_CHRONOLOGY_PROMPT_CHARS = 10000;
const MAX_PROMPT_ISSUES = 10;

/**
 * The rule-based "bad facts" as a short list for the model. Citation ids are
 * given only for entries that are in the citation catalog.
 */
export function formatDefenseIssues(
  summary: DefenseIssuesSummary | undefined,
  citable: Set<string>,
): string {
  if (!summary || summary.issues.length === 0) return '';
  const lines = summary.issues.slice(0, MAX_PROMPT_ISSUES).map((issue) => {
    const ids = issue.evidence
      .map((item) => item.chronologyId)
      .filter((id): id is string => Boolean(id && citable.has(id)));
    return `- [${issue.severity}] ${issue.title}${ids.length > 0 ? ` (${ids.join(', ')})` : ''}`;
  });
  return [
    "Defense issues found by fixed rules in the client's records and intake form. Where relevant, address them in opposingEvidence and limitations; do not state anything about them beyond what the cited records say:",
    ...lines,
  ].join('\n');
}

/** Words from the diagnosis and question, used to keep relevant events. */
function focusTerms(request: MedicalAnalysisRequest): string[] {
  const text = `${request.diagnosis ?? ''} ${request.medicalQuestion}`;
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 4),
    ),
  ];
}

@Injectable()
export class AnalysisPromptBuilder {
  constructor(
    private readonly promptService: MedicalPromptService,
    private readonly queryBuilder: MedicalQueryBuilder,
  ) {}

  async build(
    request: MedicalAnalysisRequest,
    retrieval: RetrievalResult,
    chronology?: MedicalChronology,
    chronologyPromptChars = DEFAULT_CHRONOLOGY_PROMPT_CHARS,
    defenseIssues?: DefenseIssuesSummary,
  ): Promise<BuiltAnalysisPrompts> {
    const prompts = await this.promptService.loadAll();

    const libraryCitations: AnalysisCitation[] = retrieval.chunks.map(
      (chunk) => ({
        chunkId: chunk.chunkId,
        documentName: chunk.documentTitle,
        pageNumber: chunk.pageNumber,
        chunkNumber: chunk.chunkIndex + 1,
        similarityScore: chunk.combinedScore,
        citationText: chunk.citation.citationText,
        sourceFile: chunk.sourceFile,
        sourceKind: 'knowledge_base',
      }),
    );

    const records = this.buildRecordsContext(
      request,
      chronology,
      chronologyPromptChars,
    );
    const issuesText = formatDefenseIssues(
      defenseIssues,
      new Set(records.citations.map((citation) => citation.chunkId)),
    );
    if (issuesText) records.text = `${records.text}\n\n${issuesText}`;
    const citationCatalog = [...libraryCitations, ...records.citations];

    const catalogText = citationCatalog
      .map((c) =>
        c.sourceKind === 'medical_record'
          ? `- chunkId: ${c.chunkId} | ${c.citationText} | client medical record`
          : `- chunkId: ${c.chunkId} | ${c.citationText} | similarity: ${c.similarityScore.toFixed(3)}`,
      )
      .join('\n');

    const analysisBody = this.promptService.render(prompts.medicalAnalysis, {
      medicalQuestion: request.medicalQuestion,
      caseContext: this.queryBuilder.buildCaseContext(request),
      recordsContext: records.text,
      retrievedContext: retrieval.context.contextText,
      citationCatalog: catalogText,
    });

    const userPrompt = [
      analysisBody,
      '',
      prompts.evidenceEvaluation,
      '',
      this.promptService.render(prompts.jsonOutput, {
        allowedChunkIds: citationCatalog.map((c) => c.chunkId).join('\n'),
      }),
    ].join('\n');

    return {
      systemPrompt: prompts.system,
      userPrompt,
      allowedChunkIds: citationCatalog.map((c) => c.chunkId),
      citationCatalog,
    };
  }

  /** Chronology entries become citable evidence with ids rec-1, rec-2, ... */
  private buildRecordsContext(
    request: MedicalAnalysisRequest,
    chronology: MedicalChronology | undefined,
    maxChars: number,
  ): { text: string; citations: AnalysisCitation[] } {
    if (!chronology) {
      return {
        text: 'No medical records were provided for this case.',
        citations: [],
      };
    }
    if (chronology.events.length === 0) {
      return {
        text: 'Medical records were provided, but no medical events could be read from them. Note this in limitations.',
        citations: [],
      };
    }

    const formatted = formatChronologyForPrompt(
      chronology.events,
      maxChars,
      focusTerms(request),
    );
    const included = new Set(formatted.includedIds);
    const citations: AnalysisCitation[] = chronology.events
      .filter((event) => included.has(event.id))
      .map((event) => ({
        chunkId: event.id,
        documentName: `Medical record: ${event.documentName}`,
        pageNumber: event.pageNumber,
        chunkNumber: 0,
        similarityScore: 1,
        citationText: recordCitationText(event),
        sourceFile: event.documentName,
        sourceKind: 'medical_record',
        recordId: event.recordId,
      }));

    const note =
      formatted.omitted > 0
        ? `\n(${formatted.omitted} less relevant entries were left out for length.)`
        : '';
    return {
      text: `Entries extracted from the client's own medical records. Each line starts with its citation id and ends with the document and page.${note}\n${formatted.text}`,
      citations,
    };
  }
}
