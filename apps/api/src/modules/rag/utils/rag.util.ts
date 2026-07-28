import { createHash } from 'crypto';
import { KNOWLEDGE_CATEGORIES } from '@modules/knowledge-base/constants';
import { DOCUMENT_TYPE_FILTERS } from '../constants';
import type { RetrievalFilters } from '../types';

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function hashQuestion(question: string): string {
  return createHash('sha256')
    .update(question.trim().toLowerCase())
    .digest('hex');
}

/**
 * Build a retrieval query string from case context fields.
 */
export function buildQueryText(fields: {
  question: string;
  patientInformation?: string;
  injury?: string;
  diagnosis?: string;
  symptoms?: string;
  medicalHistory?: string;
  conversationContext?: {
    previousQuestions?: string[];
    previousContext?: string;
  };
}): string {
  const parts = [
    fields.question,
    fields.injury ? `Injury: ${fields.injury}` : '',
    fields.diagnosis ? `Diagnosis: ${fields.diagnosis}` : '',
    fields.symptoms ? `Symptoms: ${fields.symptoms}` : '',
    fields.medicalHistory ? `Medical history: ${fields.medicalHistory}` : '',
    fields.patientInformation
      ? `Patient information: ${fields.patientInformation}`
      : '',
    fields.conversationContext?.previousContext
      ? `Prior context: ${fields.conversationContext.previousContext}`
      : '',
    fields.conversationContext?.previousQuestions?.length
      ? `Prior questions: ${fields.conversationContext.previousQuestions.join('; ')}`
      : '',
  ].filter(Boolean);

  return parts.join('\n');
}

/**
 * Reciprocal Rank Fusion for hybrid search score merging.
 */
export function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string; score?: number }>>,
  k: number,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const current = scores.get(item.id) ?? 0;
      scores.set(item.id, current + 1 / (k + rank + 1));
    });
  }

  return scores;
}

/**
 * Normalize text for duplicate detection.
 */
export function normalizeForDedup(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function resolveCategoryFromDocumentType(
  documentType?: string,
): string | undefined {
  if (!documentType) return undefined;

  switch (documentType) {
    case DOCUMENT_TYPE_FILTERS.BOOK:
      return KNOWLEDGE_CATEGORIES.MEDICAL_BOOK;
    case DOCUMENT_TYPE_FILTERS.ARTICLE:
      return KNOWLEDGE_CATEGORIES.RESEARCH_ARTICLE;
    case DOCUMENT_TYPE_FILTERS.REPORT:
      return KNOWLEDGE_CATEGORIES.CASE_REPORT;
    case DOCUMENT_TYPE_FILTERS.TEMPLATE:
      return KNOWLEDGE_CATEGORIES.TEMPLATE;
    case DOCUMENT_TYPE_FILTERS.UPLOAD:
      return KNOWLEDGE_CATEGORIES.OTHER;
    default:
      return undefined;
  }
}

export interface SqlFilterClause {
  clause: string;
  params: unknown[];
}

/**
 * Build dynamic SQL WHERE clauses for retrieval filters.
 */
export function buildFilterClauses(filters: RetrievalFilters): SqlFilterClause {
  const clauses: string[] = [`id.status = 'indexed'`];
  const params: unknown[] = [];

  const category =
    filters.category ?? resolveCategoryFromDocumentType(filters.documentType);

  if (category) {
    params.push(category);
    clauses.push(`id.category = $${params.length}`);
  }

  if (filters.subCategory) {
    params.push(filters.subCategory);
    clauses.push(`id.sub_category = $${params.length}`);
  }

  if (filters.documentId) {
    params.push(filters.documentId);
    clauses.push(`id.id = $${params.length}::uuid`);
  }

  if (filters.knowledgeDocumentId) {
    params.push(filters.knowledgeDocumentId);
    clauses.push(`id.knowledge_document_id = $${params.length}`);
  }

  if (filters.extension) {
    params.push(filters.extension);
    clauses.push(`id.extension = $${params.length}`);
  }

  if (filters.pageMin !== undefined) {
    params.push(filters.pageMin);
    clauses.push(
      `(dc.page_number IS NULL OR dc.page_number >= $${params.length})`,
    );
  }

  if (filters.pageMax !== undefined) {
    params.push(filters.pageMax);
    clauses.push(
      `(dc.page_number IS NULL OR dc.page_number <= $${params.length})`,
    );
  }

  return {
    clause: clauses.join(' AND '),
    params,
  };
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
