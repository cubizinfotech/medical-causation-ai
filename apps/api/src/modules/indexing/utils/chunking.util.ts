import { createHash } from 'crypto';
import { CHARS_PER_TOKEN_ESTIMATE } from '@modules/document-processing/constants';

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function hashChunkContent(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function buildExternalChunkId(
  documentId: string,
  chunkIndex: number,
): string {
  return `${documentId}:${chunkIndex}`;
}

interface TextSegment {
  text: string;
  pageNumber: number | null;
  section: string | null;
}

/**
 * Split a text segment into token-bounded chunks with overlap.
 */
export function splitTextSegment(
  segment: TextSegment,
  chunkSizeTokens: number,
  overlapTokens: number,
  minChunkTokens: number,
): TextSegment[] {
  const text = segment.text.trim();
  if (!text) return [];

  const maxChars = chunkSizeTokens * CHARS_PER_TOKEN_ESTIMATE;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN_ESTIMATE;
  const minChars = minChunkTokens * CHARS_PER_TOKEN_ESTIMATE;

  if (text.length <= maxChars) {
    return [segment];
  }

  const chunks: TextSegment[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);
      const sentenceBreak = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('\n'),
        window.lastIndexOf(' '),
      );

      if (sentenceBreak > minChars) {
        end = start + sentenceBreak + 1;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        pageNumber: segment.pageNumber,
        section: segment.section,
      });
    }

    if (end >= text.length) break;

    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

export function buildTextSegments(input: {
  normalizedText: string;
  pages: Array<{ pageNumber: number; text: string }>;
  sections: Array<{ type: string; content: string; order: number }>;
}): TextSegment[] {
  if (input.pages.length > 0) {
    return input.pages
      .filter((page) => page.text.trim())
      .map((page) => ({
        text: page.text.trim(),
        pageNumber: page.pageNumber,
        section: null,
      }));
  }

  if (input.sections.length > 0) {
    return input.sections
      .filter((section) => section.content.trim())
      .map((section) => ({
        text: section.content.trim(),
        pageNumber: null,
        section:
          section.type === 'heading' ? section.content.trim() : section.type,
      }));
  }

  return [
    {
      text: input.normalizedText.trim(),
      pageNumber: null,
      section: null,
    },
  ];
}
