import { Injectable } from '@nestjs/common';
import { CONFIDENCE_DISCLAIMER, EVIDENCE_CLASSIFICATIONS } from '../constants';
import type {
  AlternativeExplanation,
  AnalysisCitation,
  BaseMedicalAnalysisResult,
  ClassifiedEvidence,
  MedicalAnalysisLlmOutput,
  RetrievedEvidenceItem,
} from '../types';
import type { RetrievalResult } from '@modules/rag/types';
import { AnalysisSafetyException } from '../exceptions';

const MAX_ALTERNATIVE_EXPLANATIONS = 8;
const MAX_GENERAL_KNOWLEDGE_STATEMENTS = 12;

const URL_PATTERN = /https?:\/\/[^\s)\]}>"']+/gi;
const PMID_PATTERN = /\bPMID[:\s#]*(\d{5,9})\b/gi;
const DOI_PATTERN = /\b(?:doi:\s*)?(10\.\d{4,9}\/[^\s"'<>)\]]+)/gi;

/** Links and identifiers of the sources the model was given. */
export interface VerifiedReferences {
  urls: Set<string>;
  pmids: Set<string>;
  dois: Set<string>;
}

export function verifiedReferencesFrom(
  catalog: AnalysisCitation[],
): VerifiedReferences {
  const references: VerifiedReferences = {
    urls: new Set(),
    pmids: new Set(),
    dois: new Set(),
  };
  for (const citation of catalog) {
    if (citation.url) references.urls.add(citation.url.replace(/\/+$/, ''));
    const pmid = citation.chunkId.match(/^pmid-(\d+)$/)?.[1];
    if (pmid) references.pmids.add(pmid);
    for (const match of citation.citationText.matchAll(DOI_PATTERN)) {
      references.dois.add(match[1].toLowerCase());
    }
  }
  return references;
}

/**
 * Removes links, PMIDs, and DOIs that are not among the sources the model
 * was given: a model can produce real-looking references that do not exist.
 */
export function scrubUnverifiedReferences(
  text: string,
  verified: VerifiedReferences,
): { text: string; removed: number } {
  let removed = 0;
  const scrubbed = text
    .replace(URL_PATTERN, (url) => {
      if (verified.urls.has(url.replace(/[.,;:]+$/, '').replace(/\/+$/, ''))) {
        return url;
      }
      removed++;
      return '[unverified link removed]';
    })
    .replace(PMID_PATTERN, (match, pmid: string) => {
      if (verified.pmids.has(pmid)) return match;
      removed++;
      return '[unverified PMID removed]';
    })
    .replace(DOI_PATTERN, (match, doi: string) => {
      if (verified.dois.has(doi.replace(/[.,;:]+$/, '').toLowerCase())) {
        return match;
      }
      removed++;
      return '[unverified DOI removed]';
    });
  return { text: scrubbed, removed };
}

@Injectable()
export class AnalysisSafetyValidator {
  /**
   * Applies scrubUnverifiedReferences to every free-text field the model
   * wrote. Excerpts are left alone: they are quotes of the sources.
   */
  scrubFreeText(
    output: MedicalAnalysisLlmOutput,
    verified: VerifiedReferences,
  ): { output: MedicalAnalysisLlmOutput; removed: number } {
    let removed = 0;
    const scrub = (value: string | undefined): string => {
      if (typeof value !== 'string') return value ?? '';
      const result = scrubUnverifiedReferences(value, verified);
      removed += result.removed;
      return result.text;
    };
    const scrubReasoning = <T extends { reasoning: string }>(items?: T[]) =>
      (items ?? []).map((item) => ({
        ...item,
        reasoning: scrub(item.reasoning),
      }));

    const scrubbed: MedicalAnalysisLlmOutput = {
      ...output,
      executiveSummary: scrub(output.executiveSummary),
      patientSummary: scrub(output.patientSummary),
      aiReasoning: scrub(output.aiReasoning),
      confidenceExplanation: scrub(output.confidenceExplanation),
      conclusion: scrub(output.conclusion),
      limitations: (output.limitations ?? []).map(scrub),
      supportingEvidence: scrubReasoning(output.supportingEvidence),
      opposingEvidence: scrubReasoning(output.opposingEvidence),
      neutralEvidence: scrubReasoning(output.neutralEvidence),
      retrievedEvidence: (output.retrievedEvidence ?? []).map((item) => ({
        ...item,
        classificationReasoning: scrub(item.classificationReasoning),
      })),
      citations: (output.citations ?? []).map((item) => ({
        ...item,
        statement: scrub(item.statement),
      })),
      alternativeExplanations: (output.alternativeExplanations ?? []).map(
        (item) => ({
          ...item,
          explanation: scrub(item.explanation),
          assessment: scrub(item.assessment),
        }),
      ),
      generalMedicalKnowledge: (output.generalMedicalKnowledge ?? []).map(
        scrub,
      ),
    };
    return { output: scrubbed, removed };
  }

  validateCitations(
    llmOutput: MedicalAnalysisLlmOutput,
    allowedChunkIds: Set<string>,
    citationMap: Map<string, AnalysisCitation>,
  ): void {
    const referencedIds = new Set<string>();

    const collect = (chunkId?: string) => {
      if (!chunkId) return;
      referencedIds.add(chunkId);
      if (!allowedChunkIds.has(chunkId)) {
        throw new AnalysisSafetyException(
          `LLM referenced unknown chunkId "${chunkId}" — possible hallucinated citation`,
        );
      }
      if (!citationMap.has(chunkId)) {
        throw new AnalysisSafetyException(
          `Citation mapping missing for chunkId "${chunkId}"`,
        );
      }
    };

    for (const item of llmOutput.retrievedEvidence ?? []) collect(item.chunkId);
    for (const item of llmOutput.supportingEvidence ?? [])
      collect(item.chunkId);
    for (const item of llmOutput.opposingEvidence ?? []) collect(item.chunkId);
    for (const item of llmOutput.neutralEvidence ?? []) collect(item.chunkId);
    for (const item of llmOutput.citations ?? []) collect(item.chunkId);
  }

  removeUnknownCitations(
    llmOutput: MedicalAnalysisLlmOutput,
    allowedChunkIds: Set<string>,
  ): { output: MedicalAnalysisLlmOutput; removedChunkIds: string[] } {
    const removed = new Set<string>();
    const filterItems = <T extends { chunkId: string }>(items: T[]): T[] =>
      items.filter((item) => {
        const allowed = allowedChunkIds.has(item.chunkId);
        if (!allowed) removed.add(item.chunkId);
        return allowed;
      });

    const alternativeExplanations = (
      llmOutput.alternativeExplanations ?? []
    ).map((item) => ({
      ...item,
      chunkIds: (Array.isArray(item.chunkIds) ? item.chunkIds : []).filter(
        (chunkId) => {
          const allowed =
            typeof chunkId === 'string' && allowedChunkIds.has(chunkId);
          if (!allowed) removed.add(String(chunkId));
          return allowed;
        },
      ),
    }));

    return {
      output: {
        ...llmOutput,
        retrievedEvidence: filterItems(llmOutput.retrievedEvidence ?? []),
        supportingEvidence: filterItems(llmOutput.supportingEvidence ?? []),
        opposingEvidence: filterItems(llmOutput.opposingEvidence ?? []),
        neutralEvidence: filterItems(llmOutput.neutralEvidence ?? []),
        citations: filterItems(llmOutput.citations ?? []),
        alternativeExplanations,
      },
      removedChunkIds: [...removed],
    };
  }

  clampConfidence(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

@Injectable()
export class AnalysisResponseMapper {
  mapToResult(params: {
    request: { medicalQuestion: string };
    llmOutput: MedicalAnalysisLlmOutput;
    citationMap: Map<string, AnalysisCitation>;
    retrieval: RetrievalResult;
    analysisExecutionTimeMs: number;
    llmProvider: string;
    llmModel: string;
  }): BaseMedicalAnalysisResult {
    const {
      llmOutput,
      citationMap,
      retrieval,
      analysisExecutionTimeMs,
      llmProvider,
      llmModel,
    } = params;

    const mapClassified = (
      items: Array<{ chunkId: string; excerpt: string; reasoning: string }>,
      type: ClassifiedEvidence['type'],
    ): ClassifiedEvidence[] =>
      items
        .filter((item) => citationMap.has(item.chunkId))
        .map((item) => ({
          type,
          reasoning: item.reasoning,
          excerpt: item.excerpt,
          citation: citationMap.get(item.chunkId)!,
        }));

    const retrievedEvidence: RetrievedEvidenceItem[] = (
      llmOutput.retrievedEvidence ?? []
    )
      .filter((item) => citationMap.has(item.chunkId))
      .map((item) => {
        const citation = citationMap.get(item.chunkId)!;
        return {
          chunkId: item.chunkId,
          documentName: citation.documentName,
          pageNumber: citation.pageNumber,
          chunkNumber: citation.chunkNumber,
          excerpt: item.excerpt,
          similarityScore: citation.similarityScore,
          classification:
            item.classification ?? EVIDENCE_CLASSIFICATIONS.UNKNOWN,
          classificationReasoning: item.classificationReasoning ?? '',
          citation,
        };
      });

    const supportingEvidence = mapClassified(
      llmOutput.supportingEvidence ?? [],
      EVIDENCE_CLASSIFICATIONS.SUPPORTING,
    );
    const opposingEvidence = mapClassified(
      llmOutput.opposingEvidence ?? [],
      EVIDENCE_CLASSIFICATIONS.OPPOSING,
    );
    const neutralEvidence = mapClassified(
      llmOutput.neutralEvidence ?? [],
      EVIDENCE_CLASSIFICATIONS.NEUTRAL,
    );

    const usedCitations = new Map<string, AnalysisCitation>();
    for (const group of [
      ...retrievedEvidence.map((e) => e.citation),
      ...supportingEvidence.map((e) => e.citation),
      ...opposingEvidence.map((e) => e.citation),
      ...neutralEvidence.map((e) => e.citation),
    ]) {
      usedCitations.set(group.chunkId, group);
    }

    const alternativeExplanations: AlternativeExplanation[] = (
      llmOutput.alternativeExplanations ?? []
    )
      .filter(
        (item) =>
          typeof item?.explanation === 'string' && item.explanation.trim(),
      )
      .slice(0, MAX_ALTERNATIVE_EXPLANATIONS)
      .map((item) => {
        const citations = (item.chunkIds ?? [])
          .map((chunkId) => citationMap.get(chunkId))
          .filter((citation): citation is AnalysisCitation =>
            Boolean(citation),
          );
        return {
          explanation: item.explanation.trim(),
          assessment:
            typeof item.assessment === 'string' ? item.assessment.trim() : '',
          // Cited only when a catalog source actually backs it.
          basis:
            citations.length > 0 && item.basis !== 'general_knowledge'
              ? 'cited_evidence'
              : 'general_knowledge',
          citations,
        };
      });

    const generalMedicalKnowledge = (llmOutput.generalMedicalKnowledge ?? [])
      .filter(
        (statement): statement is string =>
          typeof statement === 'string' && statement.trim().length > 0,
      )
      .map((statement) => statement.trim())
      .slice(0, MAX_GENERAL_KNOWLEDGE_STATEMENTS);

    return {
      executiveSummary: llmOutput.executiveSummary,
      patientSummary: llmOutput.patientSummary,
      medicalQuestion:
        llmOutput.medicalQuestion || params.request.medicalQuestion,
      retrievedEvidence,
      supportingEvidence,
      opposingEvidence,
      neutralEvidence,
      aiReasoning: llmOutput.aiReasoning,
      confidenceScore: {
        score: Math.max(
          0,
          Math.min(100, Math.round(llmOutput.confidenceScore)),
        ),
        explanation: llmOutput.confidenceExplanation,
        disclaimer: CONFIDENCE_DISCLAIMER,
      },
      limitations: llmOutput.limitations,
      conclusion: llmOutput.conclusion,
      citations: [...usedCitations.values()],
      alternativeExplanations,
      generalMedicalKnowledge,
      metadata: {
        retrievalExecutionTimeMs: retrieval.executionTimeMs,
        analysisExecutionTimeMs,
        llmProvider,
        llmModel,
        chunkCount: retrieval.chunks.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
