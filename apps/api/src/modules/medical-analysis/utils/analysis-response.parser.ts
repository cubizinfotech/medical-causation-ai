import type { MedicalAnalysisLlmOutput } from '../types';

export class AnalysisResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisResponseParseError';
  }
}

function stripModelReasoning(content: string): string {
  return content
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/```thinking[\s\S]*?```/gi, '')
    .trim();
}

function repairCommonJsonIssues(jsonText: string): string {
  return jsonText
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1');
}

export function extractJsonFromLlmResponse(content: string): string {
  const trimmed = stripModelReasoning(content.trim());

  if (!trimmed) {
    throw new AnalysisResponseParseError('LLM returned an empty response');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return repairCommonJsonIssues(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return repairCommonJsonIssues(trimmed.slice(start, end + 1));
  }

  throw new AnalysisResponseParseError(
    'LLM response does not contain valid JSON',
  );
}

function parseJsonObject(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText);
  } catch {
    try {
      return JSON.parse(repairCommonJsonIssues(jsonText));
    } catch {
      throw new AnalysisResponseParseError('Failed to parse LLM JSON output');
    }
  }
}

export function parseMedicalAnalysisJson(
  content: string,
): MedicalAnalysisLlmOutput {
  const jsonText = extractJsonFromLlmResponse(content);
  const parsed = parseJsonObject(jsonText);

  if (!parsed || typeof parsed !== 'object') {
    throw new AnalysisResponseParseError('LLM JSON output is not an object');
  }

  const output = parsed as MedicalAnalysisLlmOutput;

  if (!output.executiveSummary || !output.conclusion) {
    throw new AnalysisResponseParseError(
      'LLM JSON missing required fields (executiveSummary, conclusion)',
    );
  }

  return {
    executiveSummary: output.executiveSummary ?? '',
    patientSummary: output.patientSummary ?? '',
    medicalQuestion: output.medicalQuestion ?? '',
    retrievedEvidence: output.retrievedEvidence ?? [],
    supportingEvidence: output.supportingEvidence ?? [],
    opposingEvidence: output.opposingEvidence ?? [],
    neutralEvidence: output.neutralEvidence ?? [],
    aiReasoning: output.aiReasoning ?? '',
    confidenceScore: Number(output.confidenceScore ?? 0),
    confidenceExplanation: output.confidenceExplanation ?? '',
    limitations: output.limitations ?? [],
    conclusion: output.conclusion ?? '',
    citations: output.citations ?? [],
  };
}
