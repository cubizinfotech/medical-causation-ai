import type {
  AnalysisPacket,
  EwiAnalysisDocument,
  EwiAnalysisQuestion,
} from './ewi-analysis.types';
import type { EwiAnalysisConclusion } from './ewi-analysis.types';

export class AnalysisValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

export interface AiAnalysisWording {
  summary: string;
  conclusions: EwiAnalysisConclusion[];
  questions: EwiAnalysisQuestion[];
}

/**
 * Accepts model wording only when every citation exists in the collected
 * packet and the text does not introduce unsupported numbers or URLs.
 * Verification labels stay on the deterministic document.
 */
export function validateAiAnalysis(
  raw: string,
  packet: AnalysisPacket,
): AiAnalysisWording {
  const parsed = parseJsonObject(raw);
  const summary = readString(parsed.summary, 'summary');
  const conclusions = readConclusions(parsed.conclusions);
  const questions = readQuestions(parsed.questions);
  const allowed = allowedRefs(packet);
  const corpus = corpusText(packet);

  assertGrounded(summary, corpus);
  for (const conclusion of conclusions) {
    assertRefs(conclusion.sourceRefs, allowed, 'conclusion');
    assertGrounded(conclusion.text, corpus);
  }
  for (const question of questions) {
    assertRefs(question.sourceRefs, allowed, 'question');
    assertGrounded(question.question, corpus);
    assertGrounded(question.category, corpus);
  }

  return { summary, conclusions, questions };
}

export function applyAiWording(
  document: EwiAnalysisDocument,
  wording: AiAnalysisWording,
): EwiAnalysisDocument {
  return {
    ...document,
    summary: wording.summary,
    conclusions: wording.conclusions,
    questions: wording.questions,
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new AnalysisValidationError(
      'malformed',
      'AI analysis was not valid JSON.',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AnalysisValidationError(
      'malformed',
      'AI analysis JSON must be an object.',
    );
  }
  return parsed as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AnalysisValidationError(
      'malformed',
      `AI analysis is missing ${field}.`,
    );
  }
  return value.trim();
}

function readConclusions(value: unknown): EwiAnalysisConclusion[] {
  if (!Array.isArray(value)) {
    throw new AnalysisValidationError(
      'malformed',
      'AI analysis conclusions must be an array.',
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new AnalysisValidationError(
        'malformed',
        'AI conclusion must be an object.',
      );
    }
    const record = item as Record<string, unknown>;
    return {
      text: readString(record.text, 'conclusion text'),
      sourceRefs: readRefs(record.sourceRefs),
    };
  });
}

function readQuestions(value: unknown): EwiAnalysisQuestion[] {
  if (!Array.isArray(value)) {
    throw new AnalysisValidationError(
      'malformed',
      'AI analysis questions must be an array.',
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new AnalysisValidationError(
        'malformed',
        'AI question must be an object.',
      );
    }
    const record = item as Record<string, unknown>;
    return {
      category: readString(record.category, 'question category'),
      question: readString(record.question, 'question'),
      sourceRefs: readRefs(record.sourceRefs),
    };
  });
}

function readRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AnalysisValidationError(
      'unsupported_source',
      'AI output omitted a source reference.',
    );
  }
  return value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new AnalysisValidationError(
        'malformed',
        'Source references must be strings.',
      );
    }
    return item.trim();
  });
}

function allowedRefs(packet: AnalysisPacket): Set<string> {
  return new Set([
    ...packet.findings.map((finding) => finding.findingKey),
    ...packet.sourceAttempts.map((attempt) => attempt.sourceRef),
  ]);
}

function corpusText(packet: AnalysisPacket): string {
  return [
    packet.expertName,
    packet.specialty,
    JSON.stringify(packet.findings),
    JSON.stringify(packet.sourceAttempts),
    'could not verify',
  ]
    .join('\n')
    .toLowerCase();
}

function assertRefs(refs: string[], allowed: Set<string>, label: string): void {
  for (const ref of refs) {
    if (!allowed.has(ref)) {
      throw new AnalysisValidationError(
        'unsupported_source',
        `AI ${label} cited ${ref}, which is not a collected source.`,
      );
    }
  }
}

function assertGrounded(text: string, corpus: string): void {
  const urls = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  for (const match of urls) {
    const url = match.replace(/[?.,;:]+$/g, '').toLowerCase();
    if (!corpus.includes(url)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        'AI output included a URL that was not collected.',
      );
    }
  }
  const numbers = text.match(/\b\d{2,}\b/g) ?? [];
  for (const value of numbers) {
    if (!corpus.includes(value)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        'AI output included a number that was not collected.',
      );
    }
  }
  const phrases = [
    /\bph\.?d\.?\b/i,
    /\bm\.?d\.?\b/i,
    /\bboard[- ]certified\b/i,
    /\bpmid\b/i,
    /\blinkedin\b/i,
    /\btwitter\b/i,
  ];
  for (const pattern of phrases) {
    const match = text.match(pattern);
    if (match && !corpus.includes(match[0].toLowerCase())) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        'AI output included a qualification or channel that was not collected.',
      );
    }
  }
}
