import { Injectable } from '@nestjs/common';
import type { IContextBuilder } from '../interfaces';
import type { BuiltContext, RetrievedChunk } from '../types';
import { estimateTokens, normalizeForDedup } from '../utils';

@Injectable()
export class ContextBuilder implements IContextBuilder {
  build(chunks: RetrievedChunk[], maxTokens: number): BuiltContext {
    const sorted = [...chunks].sort(
      (a, b) => b.combinedScore - a.combinedScore,
    );

    const seen = new Set<string>();
    const selected: RetrievedChunk[] = [];
    let tokenCount = 0;
    let truncated = false;

    for (const chunk of sorted) {
      const normalized = normalizeForDedup(chunk.text);
      if (seen.has(normalized)) continue;

      const chunkTokens = estimateTokens(chunk.text);
      const headerTokens = estimateTokens(chunk.citation.citationText) + 4;

      if (tokenCount + chunkTokens + headerTokens > maxTokens) {
        truncated = true;
        break;
      }

      seen.add(normalized);
      selected.push(chunk);
      tokenCount += chunkTokens + headerTokens;
    }

    const contextText = selected
      .map(
        (chunk, order) =>
          `--- Evidence ${order + 1} ${chunk.citation.citationText} ---\n${chunk.text}`,
      )
      .join('\n\n');

    return {
      contextText,
      citations: selected.map((chunk) => chunk.citation),
      chunkCount: selected.length,
      estimatedTokens: estimateTokens(contextText),
      truncated,
    };
  }
}
