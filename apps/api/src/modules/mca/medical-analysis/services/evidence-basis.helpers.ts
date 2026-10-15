import type { RetrievalResult } from '@modules/rag/types';
import { UNCITED_CONFIDENCE_CAP } from '../constants';
import type {
  AnalysisPromptMode,
  BaseMedicalAnalysisResult,
  EvidenceBasis,
  EvidenceBasisMode,
  LiteratureSearchSummary,
} from '../types';

/**
 * The library alone backs the analysis only when it returned enough
 * passages that match the case closely. Results without a coverage measure
 * (older callers, tests) count as sufficient when they have any passage.
 */
export function libraryIsSufficient(retrieval: RetrievalResult): boolean {
  return retrieval.coverage
    ? retrieval.coverage.sufficient
    : retrieval.chunks.length > 0;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function literatureGap(summary?: LiteratureSearchSummary): string {
  switch (summary?.status) {
    case 'disabled':
      return 'Published-study search (PubMed) is turned off for this site.';
    case 'unavailable':
      return 'PubMed could not be searched for published studies.';
    case 'no_results':
      return 'PubMed returned no matching published studies.';
    default:
      return 'No published study abstracts were available.';
  }
}

/** What the finished analysis rests on, in words for the report. */
export function buildEvidenceBasis(params: {
  promptMode: AnalysisPromptMode;
  retrieval: RetrievalResult;
  offered: {
    libraryPassages: number;
    literatureArticles: number;
    recordEntries: number;
  };
  result: BaseMedicalAnalysisResult;
  literature?: LiteratureSearchSummary;
}): EvidenceBasis {
  const { promptMode, retrieval, offered, result } = params;
  const cited = (kind: 'knowledge_base' | 'public_literature') =>
    result.citations.filter(
      (citation) => (citation.sourceKind ?? 'knowledge_base') === kind,
    ).length;
  const libraryCited = cited('knowledge_base');
  const literatureCited = cited('public_literature');
  const usesGeneralKnowledge =
    (result.generalMedicalKnowledge?.length ?? 0) > 0 ||
    (result.alternativeExplanations ?? []).some(
      (item) => item.basis === 'general_knowledge',
    );

  let mode: EvidenceBasisMode;
  if (promptMode === 'library') {
    mode = 'knowledge_base';
  } else if (libraryCited > 0 && literatureCited > 0) {
    mode = 'knowledge_base_and_literature';
  } else if (literatureCited > 0) {
    mode = 'literature';
  } else if (libraryCited > 0) {
    mode = 'knowledge_base';
  } else {
    mode = 'general_knowledge';
  }

  const records =
    offered.recordEntries > 0
      ? ` Facts of the case come from ${offered.recordEntries} ${offered.recordEntries === 1 ? 'entry' : 'entries'} in the client's medical records.`
      : '';
  const aiNote = usesGeneralKnowledge
    ? ' Points marked as AI reasoning come from general medical knowledge, not from a cited source; have a qualified medical expert verify them.'
    : '';

  let note: string;
  if (promptMode === 'library') {
    note = `Based on ${plural(offered.libraryPassages, 'passage')} from the firm's medical library that match this question.${records}${aiNote}`;
  } else {
    const keywordOnly = retrieval.coverage?.searchMode === 'keyword_only';
    const library = keywordOnly
      ? `The firm's medical library could only be searched by keyword for this analysis${offered.libraryPassages > 0 ? `; ${plural(offered.libraryPassages, 'passage')} matched the question's terms` : ', and no passage matched'}.`
      : offered.libraryPassages === 0
        ? "The firm's medical library had no passages that closely match this question."
        : `The firm's medical library had only ${plural(offered.libraryPassages, 'passage')} that closely match this question.`;
    const literature =
      offered.literatureArticles > 0
        ? ` The analysis drew on ${plural(offered.literatureArticles, 'published study abstract')} from PubMed (${literatureCited} cited).`
        : ` ${literatureGap(params.literature)}`;
    note = `${library}${literature}${records}${aiNote}`;
  }

  return {
    mode,
    knowledgeBasePassages: offered.libraryPassages,
    relevantKnowledgeBasePassages:
      retrieval.coverage?.relevantChunkCount ?? offered.libraryPassages,
    literatureArticles: offered.literatureArticles,
    recordEntries: offered.recordEntries,
    usesGeneralKnowledge: usesGeneralKnowledge || mode === 'general_knowledge',
    note,
  };
}

/**
 * Without a cited library passage or published study, the medical science
 * in the analysis is AI reasoning: its confidence is capped and the report
 * says why. Client records alone establish facts, not medical causation.
 */
export function capUncitedConfidence(
  result: BaseMedicalAnalysisResult,
  basis: EvidenceBasis,
): BaseMedicalAnalysisResult {
  if (basis.mode !== 'general_knowledge') return result;
  const limitation =
    'No published study or library passage supports this analysis. Its medical reasoning is AI-generated from general medical knowledge and must be reviewed by a qualified medical expert before it is relied on.';
  const capped = result.confidenceScore.score > UNCITED_CONFIDENCE_CAP;
  return {
    ...result,
    confidenceScore: capped
      ? {
          ...result.confidenceScore,
          score: UNCITED_CONFIDENCE_CAP,
          explanation:
            `${result.confidenceScore.explanation} (Capped at ${UNCITED_CONFIDENCE_CAP} because no cited source supports the causal relationship.)`.trim(),
        }
      : result.confidenceScore,
    limitations: result.limitations.includes(limitation)
      ? result.limitations
      : [limitation, ...result.limitations],
  };
}
