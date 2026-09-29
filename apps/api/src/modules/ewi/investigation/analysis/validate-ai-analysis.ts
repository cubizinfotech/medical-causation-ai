import type {
  AnalysisPacket,
  EwiAnalysisConclusion,
  EwiAnalysisDocument,
  EwiAnalysisFindingNote,
  EwiAnalysisQuestion,
  EwiAnalysisSectionId,
  EwiAnalysisSectionSummary,
  EwiAssessment,
} from './ewi-analysis.types';
import {
  EWI_ANALYSIS_SECTIONS,
  EWI_ASSESSMENTS,
  MIN_LEADING_QUESTIONS,
} from './ewi-analysis.types';

export class AnalysisValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

const ASSESSMENT_SET = new Set<string>(EWI_ASSESSMENTS);
const SECTION_SET = new Set<string>(EWI_ANALYSIS_SECTIONS);

/**
 * Model wording overlay. Structure/assessments stay on the deterministic document.
 */
export interface AiAnalysisWording {
  summary: string;
  conclusions: EwiAnalysisConclusion[];
  questions: EwiAnalysisQuestion[];
  sectionSummaries?: EwiAnalysisSectionSummary[];
  investigationFindings?: EwiAnalysisFindingNote[];
}

/**
 * Accepts model wording only when every citation exists in the collected
 * packet and the text does not invent unsupported facts.
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
  const sectionSummaries =
    parsed.sectionSummaries === undefined
      ? undefined
      : readSectionSummaries(parsed.sectionSummaries);
  const investigationFindings =
    parsed.investigationFindings === undefined
      ? undefined
      : readInvestigationFindings(parsed.investigationFindings);

  const allowed = allowedRefs(packet);
  const corpus = corpusText(packet);

  assertGrounded(summary, corpus, 'summary');
  for (const conclusion of conclusions) {
    assertRefs(conclusion.sourceRefs, allowed, 'conclusion');
    assertGrounded(conclusion.text, corpus, 'conclusion');
  }
  for (const question of questions) {
    assertRefs(question.sourceRefs, allowed, 'question');
    assertGrounded(question.question, corpus, 'question');
    assertGrounded(question.category, corpus, 'question category');
    if (question.uncertaintyNote) {
      assertGrounded(question.uncertaintyNote, corpus, 'uncertaintyNote');
    }
  }

  if (sectionSummaries) {
    for (const section of sectionSummaries) {
      assertRefs(section.sourceRefs, allowed, 'sectionSummaries');
      assertFindingKeys(
        section.findingKeys,
        packet,
        'sectionSummaries.findingKeys',
      );
      assertGrounded(section.text, corpus, 'sectionSummaries');
    }
  }

  if (investigationFindings) {
    for (const finding of investigationFindings) {
      assertRefs(finding.sourceRefs, allowed, 'investigationFindings');
      assertGrounded(finding.text, corpus, 'investigationFindings');
    }
  }

  if (questions.length < MIN_LEADING_QUESTIONS) {
    throw new AnalysisValidationError(
      'malformed',
      `AI analysis questions must contain at least ${MIN_LEADING_QUESTIONS} evidence-grounded items (got ${questions.length}).`,
    );
  }

  return {
    summary,
    conclusions,
    questions,
    ...(sectionSummaries ? { sectionSummaries } : {}),
    ...(investigationFindings ? { investigationFindings } : {}),
  };
}

export function applyAiWording(
  document: EwiAnalysisDocument,
  wording: AiAnalysisWording,
): EwiAnalysisDocument {
  const sectionSummaries = wording.sectionSummaries?.length
    ? mergeSectionWording(document.sectionSummaries, wording.sectionSummaries)
    : document.sectionSummaries;

  const investigationFindings = wording.investigationFindings?.length
    ? wording.investigationFindings
    : document.investigationFindings;

  return {
    ...document,
    summary: wording.summary,
    conclusions: wording.conclusions,
    questions: wording.questions,
    sectionSummaries,
    investigationFindings,
  };
}

function mergeSectionWording(
  base: EwiAnalysisSectionSummary[],
  ai: EwiAnalysisSectionSummary[],
): EwiAnalysisSectionSummary[] {
  return base.map((baseSection) => {
    const overlay = ai.find((s) => s.section === baseSection.section);
    if (!overlay) return baseSection;
    return {
      ...baseSection,
      text: overlay.text || baseSection.text,
      // Keep deterministic status; model cannot upgrade evidence labels.
      sourceRefs: overlay.sourceRefs.length
        ? overlay.sourceRefs
        : baseSection.sourceRefs,
      findingKeys: overlay.findingKeys.length
        ? overlay.findingKeys
        : baseSection.findingKeys,
    };
  });
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

function readAssessment(value: unknown, field: string): EwiAssessment {
  const assessment = readString(value, field);
  if (!ASSESSMENT_SET.has(assessment)) {
    throw new AnalysisValidationError(
      'malformed',
      `${field} must be one of: ${EWI_ASSESSMENTS.join(', ')}`,
    );
  }
  return assessment as EwiAssessment;
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

function readOptionalRefs(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AnalysisValidationError(
      'malformed',
      `${field} must be an array.`,
    );
  }
  return value.map((item, i) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new AnalysisValidationError(
        'malformed',
        `${field}[${i}] must be a string.`,
      );
    }
    return item.trim();
  });
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
    const uncertaintyNote =
      record.uncertaintyNote === undefined || record.uncertaintyNote === null
        ? undefined
        : readString(record.uncertaintyNote, 'uncertaintyNote');
    return {
      category: readString(record.category, 'question category'),
      question: readString(record.question, 'question'),
      sourceRefs: readRefs(record.sourceRefs),
      ...(uncertaintyNote ? { uncertaintyNote } : {}),
    };
  });
}

function readSectionSummaries(value: unknown): EwiAnalysisSectionSummary[] {
  if (!Array.isArray(value)) {
    throw new AnalysisValidationError(
      'malformed',
      'sectionSummaries must be an array.',
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new AnalysisValidationError(
        'malformed',
        'sectionSummaries item must be an object.',
      );
    }
    const record = item as Record<string, unknown>;
    const section = readString(record.section, 'sectionSummaries.section');
    if (!SECTION_SET.has(section)) {
      throw new AnalysisValidationError(
        'malformed',
        `Unknown analysis section: ${section}`,
      );
    }
    return {
      section: section as EwiAnalysisSectionId,
      text: readString(record.text, 'sectionSummaries.text'),
      status: readAssessment(record.status, 'sectionSummaries.status'),
      sourceRefs: readOptionalRefs(
        record.sourceRefs,
        'sectionSummaries.sourceRefs',
      ),
      findingKeys: readOptionalRefs(
        record.findingKeys,
        'sectionSummaries.findingKeys',
      ),
    };
  });
}

function readInvestigationFindings(value: unknown): EwiAnalysisFindingNote[] {
  if (!Array.isArray(value)) {
    throw new AnalysisValidationError(
      'malformed',
      'investigationFindings must be an array.',
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new AnalysisValidationError(
        'malformed',
        'investigationFindings item must be an object.',
      );
    }
    const record = item as Record<string, unknown>;
    return {
      text: readString(record.text, 'investigationFindings.text'),
      status: readAssessment(record.status, 'investigationFindings.status'),
      sourceRefs: readRefs(record.sourceRefs),
    };
  });
}

function allowedRefs(packet: AnalysisPacket): Set<string> {
  return new Set([
    ...packet.findings.map((finding) => finding.findingKey),
    ...packet.findings
      .map((finding) => finding.url)
      .filter((url): url is string => Boolean(url)),
    ...packet.sourceAttempts.map((attempt) => attempt.sourceRef),
  ]);
}

function assertFindingKeys(
  keys: string[],
  packet: AnalysisPacket,
  label: string,
): void {
  const allowed = new Set(packet.findings.map((f) => f.findingKey));
  for (const key of keys) {
    if (!allowed.has(key)) {
      throw new AnalysisValidationError(
        'unsupported_source',
        `AI ${label} cited ${key}, which is not a collected source.`,
      );
    }
  }
}

function corpusText(packet: AnalysisPacket): string {
  return [
    packet.expertName,
    packet.specialty,
    JSON.stringify(packet.findings),
    JSON.stringify(packet.sourceAttempts),
    'could not verify',
    'not verified',
    'partially verified',
    'not found',
    'unavailable',
    'restricted',
    'conflicting',
    'verified',
    // Allow uncertainty phrasing used in prompts/questions
    'uncertainty',
    'weak',
    'open',
    'alternate',
    'authorized',
    'documentation',
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

/**
 * Reject invented cases, dates, publications, credentials, quotes,
 * court findings, income, social posts, testimony, and statistics.
 */
export function assertGrounded(
  text: string,
  corpus: string,
  label = 'output',
): void {
  const urls = text.match(/https?:\/\/[^\s)"]+/gi) ?? [];
  for (const match of urls) {
    const url = match.replace(/[?.,;:]+$/g, '').toLowerCase();
    if (!corpus.includes(url)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} included a URL that was not collected.`,
      );
    }
  }

  const dollars = text.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
  for (const amount of dollars) {
    if (!corpus.includes(amount.toLowerCase())) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} invented income/amount not in collected evidence: ${amount}`,
      );
    }
  }

  const years = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  for (const year of years) {
    if (!corpus.includes(year)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} invented a date/year that was not collected: ${year}`,
      );
    }
  }

  const quotes = text.match(/"([^"]{3,})"/g) ?? [];
  for (const quote of quotes) {
    const inner = quote.slice(1, -1).toLowerCase();
    // Titles from findings appear in corpus with quotes stripped in JSON — require substring.
    if (!corpus.includes(inner)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} invented a quote that was not collected.`,
      );
    }
  }

  const dockets = text.match(/\b\d:\d{2}-[a-z]{2}-\d+\b/gi) ?? [];
  for (const docket of dockets) {
    if (!corpus.includes(docket.toLowerCase())) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} invented a case citation that was not collected: ${docket}`,
      );
    }
  }

  const percentages = text.match(/\b\d{1,3}(?:\.\d+)?%\b/g) ?? [];
  for (const pct of percentages) {
    if (!corpus.includes(pct.toLowerCase())) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} invented a statistic that was not collected: ${pct}`,
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
    /\bdoctor of osteopathy\b/i,
    /\bboard[- ]certified\b/i,
    /\bpmid\b/i,
    /\blinkedin\b/i,
    /\btwitter\b/i,
    /\bx\.com\b/i,
    /\bfacebook\b/i,
    /\binstagram\b/i,
    /\bdeposed\b/i,
    /\btestified that\b/i,
    /\bcourt found\b/i,
    /\bgranted summary judgment\b/i,
    /\bpatent no\.?\b/i,
    /\bnih grant\b/i,
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

  const banned = [
    'according to unverified rumor',
    'it is well known that',
    'everyone knows',
    'presumably earned',
    'must have testified',
  ];
  const lower = text.toLowerCase();
  for (const phrase of banned) {
    if (lower.includes(phrase)) {
      throw new AnalysisValidationError(
        'unsupported_claim',
        `AI ${label} used unsupported speculative phrasing.`,
      );
    }
  }
}
