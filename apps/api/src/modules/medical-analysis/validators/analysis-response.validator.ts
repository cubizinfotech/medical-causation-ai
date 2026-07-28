import { Injectable } from '@nestjs/common';
import { CONFIDENCE_DISCLAIMER, EVIDENCE_CLASSIFICATIONS } from '../constants';
import type {
  AnalysisCitation,
  ClassifiedEvidence,
  MedicalAnalysisLlmOutput,
  MedicalAnalysisResult,
  RetrievedEvidenceItem,
} from '../types';
import type { RetrievalResult } from '@modules/rag/types';
import { AnalysisSafetyException } from '../exceptions';

@Injectable()
export class AnalysisSafetyValidator {
  validateRetrievalHasContext(retrieval: RetrievalResult): void {
    if (
      retrieval.chunks.length === 0 ||
      !retrieval.context.contextText.trim()
    ) {
      throw new AnalysisSafetyException(
        'No retrieved evidence available. Analysis cannot proceed without knowledge base context.',
      );
    }
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
  }): MedicalAnalysisResult {
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
