import { Injectable } from '@nestjs/common';
import type { RetrievalResult, RetrievedChunk } from '@modules/rag/types';
import type {
  MedicalAnalysisRequest,
  BuiltAnalysisPrompts,
  AnalysisCitation,
  AnalysisPromptMode,
  DefenseIssuesSummary,
  MedicalChronology,
  PublicReference,
} from '../types';
import { MedicalPromptService } from '../prompts';
import {
  formatChronologyForPrompt,
  recordCitationText,
} from '../records/chronology.helpers';
import { MedicalQueryBuilder } from './medical-query.builder';

const DEFAULT_CHRONOLOGY_PROMPT_CHARS = 10000;
const MAX_PROMPT_ISSUES = 10;
const MAX_LITERATURE_ARTICLES = 8;
/** Without a vector score, keep the best keyword matches only. */
const MAX_KEYWORD_ONLY_PASSAGES = 5;

const GENERAL_KNOWLEDGE_RULES: Record<AnalysisPromptMode, string> = {
  library:
    'leave it empty ([]); this analysis must rest on the provided evidence.',
  supplemented:
    'list each statement from general medical knowledge (not from a provided source) that your reasoning relies on. No citations, statistics, study names, authors, or links in these statements.',
};

export interface AnalysisPromptOptions {
  mode?: AnalysisPromptMode;
  /** PubMed results; only those with an abstract excerpt become evidence. */
  literature?: PublicReference[];
}

/** PubMed abstracts as citable evidence, keyed by their reference id. */
export function literatureCitations(
  references: PublicReference[],
): Array<{ citation: AnalysisCitation; excerpt: string; label: string }> {
  return references
    .filter((reference) => reference.excerpt?.trim())
    .slice(0, MAX_LITERATURE_ARTICLES)
    .map((reference) => {
      const details = [reference.journal, reference.year]
        .filter(Boolean)
        .join(', ');
      const label = `${reference.title}${details ? ` (${details}${reference.publicationType ? `; ${reference.publicationType}` : ''})` : ''}`;
      return {
        label,
        excerpt: reference.excerpt!.trim(),
        citation: {
          chunkId: reference.id,
          documentName: reference.title,
          pageNumber: null,
          chunkNumber: 0,
          similarityScore: 0,
          citationText: `[PubMed${reference.pmid ? ` PMID ${reference.pmid}` : ''}: ${label}]`,
          sourceFile: reference.url,
          sourceKind: 'public_literature',
          url: reference.url,
        },
      };
    });
}

/**
 * Library passages for a supplemented analysis: only those that matched the
 * case closely, so off-topic text is not offered as evidence.
 */
function supplementedLibraryChunks(
  retrieval: RetrievalResult,
): RetrievedChunk[] {
  if (retrieval.coverage?.searchMode === 'keyword_only') {
    return retrieval.chunks.slice(0, MAX_KEYWORD_ONLY_PASSAGES);
  }
  return retrieval.chunks.filter((chunk) => chunk.relevant);
}

function formatLibraryContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk, order) =>
        `--- Evidence ${order + 1} ${chunk.citation.citationText} ---\n${chunk.text}`,
    )
    .join('\n\n');
}

function coverageNote(
  libraryPassages: number,
  literatureArticles: number,
  keywordOnly: boolean,
): string {
  const library = keywordOnly
    ? `The firm's medical library could only be searched by keyword; ${libraryPassages} passage(s) matched the question's terms and may or may not be on topic.`
    : libraryPassages === 0
      ? "The firm's medical library returned no passages that closely match this question."
      : `The firm's medical library returned only ${libraryPassages} closely matching passage(s).`;
  const literature =
    literatureArticles === 0
      ? 'No published study abstracts were available.'
      : `${literatureArticles} published study abstract(s) from PubMed are included.`;
  return `${library} ${literature}`;
}

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
    options: AnalysisPromptOptions = {},
  ): Promise<BuiltAnalysisPrompts> {
    const prompts = await this.promptService.loadAll();
    const mode: AnalysisPromptMode = options.mode ?? 'library';
    const libraryChunks =
      mode === 'supplemented'
        ? supplementedLibraryChunks(retrieval)
        : retrieval.chunks;
    const literature =
      mode === 'supplemented'
        ? literatureCitations(options.literature ?? [])
        : [];

    const libraryCitations: AnalysisCitation[] = libraryChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentName: chunk.documentTitle,
      pageNumber: chunk.pageNumber,
      chunkNumber: chunk.chunkIndex + 1,
      similarityScore: chunk.combinedScore,
      citationText: chunk.citation.citationText,
      sourceFile: chunk.sourceFile,
      sourceKind: 'knowledge_base',
    }));

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
    const citationCatalog = [
      ...libraryCitations,
      ...literature.map((item) => item.citation),
      ...records.citations,
    ];

    const catalogText = citationCatalog
      .map((c) =>
        c.sourceKind === 'medical_record'
          ? `- chunkId: ${c.chunkId} | ${c.citationText} | client medical record`
          : c.sourceKind === 'public_literature'
            ? `- chunkId: ${c.chunkId} | ${c.citationText} | published study abstract`
            : `- chunkId: ${c.chunkId} | ${c.citationText} | similarity: ${c.similarityScore.toFixed(3)}`,
      )
      .join('\n');

    const shared = {
      medicalQuestion: request.medicalQuestion,
      caseContext: this.queryBuilder.buildCaseContext(request),
      recordsContext: records.text,
      citationCatalog: catalogText,
    };
    const analysisBody =
      mode === 'supplemented'
        ? this.promptService.render(prompts.supplementedAnalysis, {
            ...shared,
            coverageNote: coverageNote(
              libraryChunks.length,
              literature.length,
              retrieval.coverage?.searchMode === 'keyword_only',
            ),
            retrievedContext:
              libraryChunks.length > 0
                ? formatLibraryContext(libraryChunks)
                : 'No closely matching passages.',
            literatureContext:
              literature.length > 0
                ? literature
                    .map(
                      (item) =>
                        `--- ${item.citation.chunkId} | ${item.label} ---\n${item.excerpt}`,
                    )
                    .join('\n\n')
                : 'None available.',
          })
        : this.promptService.render(prompts.medicalAnalysis, {
            ...shared,
            retrievedContext: retrieval.context.contextText,
          });

    const userPrompt = [
      analysisBody,
      '',
      prompts.evidenceEvaluation,
      '',
      this.promptService.render(prompts.jsonOutput, {
        allowedChunkIds: citationCatalog.map((c) => c.chunkId).join('\n'),
        generalKnowledgeRule: GENERAL_KNOWLEDGE_RULES[mode],
      }),
    ].join('\n');

    return {
      systemPrompt:
        mode === 'supplemented' ? prompts.supplementedSystem : prompts.system,
      userPrompt,
      allowedChunkIds: citationCatalog.map((c) => c.chunkId),
      citationCatalog,
      mode,
      offered: {
        libraryPassages: libraryCitations.length,
        literatureArticles: literature.length,
        recordEntries: records.citations.length,
      },
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
