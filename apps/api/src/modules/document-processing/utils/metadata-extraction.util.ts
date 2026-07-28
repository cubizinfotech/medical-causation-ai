import { stat } from 'fs/promises';
import { basename } from 'path';
import type { ExtractedDocumentMetadata, ProcessedPage } from '../types';
import type { ParserOutput } from '../interfaces';
import {
  countWords,
  deriveTitle,
  estimateTokens,
} from './text-normalization.util';

/**
 * Build extracted metadata from parser output and file stats.
 */
export function buildExtractedMetadata(params: {
  filename: string;
  extension: string;
  fileSize: number;
  createdAt: Date;
  modifiedAt: Date;
  parserOutput: ParserOutput;
  normalizedText: string;
}): ExtractedDocumentMetadata {
  const { parserOutput, normalizedText } = params;
  const wordCount = countWords(normalizedText);
  const charCount = normalizedText.length;

  return {
    title: parserOutput.title ?? deriveTitle(params.filename),
    filename: params.filename,
    extension: params.extension,
    fileSize: params.fileSize,
    pageCount: parserOutput.pageCount,
    wordCount,
    charCount,
    estimatedTokens: estimateTokens(normalizedText),
    createdAt: params.createdAt,
    modifiedAt: params.modifiedAt,
    author: parserOutput.author,
    needsOcr: parserOutput.needsOcr ?? false,
  };
}

/**
 * Read file system metadata for a document path.
 */
export async function readFileMetadata(filePath: string): Promise<{
  fileSize: number;
  createdAt: Date;
  modifiedAt: Date;
  filename: string;
}> {
  const fileStat = await stat(filePath);
  return {
    fileSize: fileStat.size,
    createdAt: fileStat.birthtime,
    modifiedAt: fileStat.mtime,
    filename: basename(filePath),
  };
}

/**
 * Compute aggregate stats from pages.
 */
export function summarizePages(pages: ProcessedPage[]): {
  totalChars: number;
  totalWords: number;
  avgCharsPerPage: number;
} {
  const totalChars = pages.reduce((sum, p) => sum + p.charCount, 0);
  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);
  const avgCharsPerPage = pages.length > 0 ? totalChars / pages.length : 0;
  return { totalChars, totalWords, avgCharsPerPage };
}
