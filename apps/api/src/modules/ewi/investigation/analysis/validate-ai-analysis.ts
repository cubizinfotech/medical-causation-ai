import type {
  AnalysisPacket,
  EwiAnalysisConclusion,
  EwiAnalysisDocument,
  EwiAnalysisFindingNote,
  EwiAnalysisSectionId,
  EwiAnalysisSectionSummary,
  EwiAssessment,
} from './ewi-analysis.types';
import { EWI_ANALYSIS_SECTIONS, EWI_ASSESSMENTS } from './ewi-analysis.types';

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
  /** Always empty: questions are built from the evidence, not by the model. */
  questions: never[];
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

  return {
    summary,
    conclusions,
    // Cross-examination questions are built from the evidence elsewhere
    // (ewi-report-questions); model questions are not used.
    questions: [],
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

/**
 * Same-meaning spellings models use for the status labels. None maps to a
 * stronger label than it says, so nothing is upgraded to verified.
 */
const ASSESSMENT_ALIASES: Record<string, string> = {
  unverified: 'not_verified',
  unknown: 'not_verified',
  insufficient: 'not_verified',
  inconclusive: 'not_verified',
  not_available: 'unavailable',
  restricted_unavailable: 'restricted',
  no_result: 'not_found',
  no_record: 'not_found',
  none: 'not_found',
};

function normalizeAssessment(written: string): EwiAssessment {
  const label = written.toLowerCase().replace(/[\s-]+/g, '_');
  const assessment = ASSESSMENT_ALIASES[label] ?? label;
  // A label outside the enum cannot upgrade evidence. Keep the wording.
  return ASSESSMENT_SET.has(assessment)
    ? (assessment as EwiAssessment)
    : 'not_verified';
}

function readAssessment(value: unknown, field: string): EwiAssessment {
  return normalizeAssessment(readString(value, field));
}

/**
 * A section's status from the model is never shown: mergeSectionWording
 * keeps the status derived from the sources. A missing or unknown label
 * there is read as the most cautious one instead of discarding the wording.
 */
function readSectionStatus(value: unknown): EwiAssessment {
  return typeof value === 'string'
    ? normalizeAssessment(value)
    : 'not_verified';
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
      status: readSectionStatus(record.status),
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
        `AI ${label} included a number that was not collected.`,
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
