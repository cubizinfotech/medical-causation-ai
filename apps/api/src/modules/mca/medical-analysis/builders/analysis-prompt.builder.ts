import { Injectable } from '@nestjs/common';
import type { RetrievalResult } from '@modules/rag/types';
import type {
  MedicalAnalysisRequest,
  BuiltAnalysisPrompts,
  AnalysisCitation,
} from '../types';
import { MedicalPromptService } from '../prompts';
import { MedicalQueryBuilder } from './medical-query.builder';

@Injectable()
export class AnalysisPromptBuilder {
  constructor(
    private readonly promptService: MedicalPromptService,
    private readonly queryBuilder: MedicalQueryBuilder,
  ) {}

  async build(
    request: MedicalAnalysisRequest,
    retrieval: RetrievalResult,
  ): Promise<BuiltAnalysisPrompts> {
    const prompts = await this.promptService.loadAll();

    const citationCatalog: AnalysisCitation[] = retrieval.chunks.map(
      (chunk) => ({
        chunkId: chunk.chunkId,
        documentName: chunk.documentTitle,
        pageNumber: chunk.pageNumber,
        chunkNumber: chunk.chunkIndex + 1,
        similarityScore: chunk.combinedScore,
        citationText: chunk.citation.citationText,
        sourceFile: chunk.sourceFile,
      }),
    );

    const catalogText = citationCatalog
      .map(
        (c) =>
          `- chunkId: ${c.chunkId} | ${c.citationText} | similarity: ${c.similarityScore.toFixed(3)}`,
      )
      .join('\n');

    const analysisBody = this.promptService.render(prompts.medicalAnalysis, {
      medicalQuestion: request.medicalQuestion,
      caseContext: this.queryBuilder.buildCaseContext(request),
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
}
