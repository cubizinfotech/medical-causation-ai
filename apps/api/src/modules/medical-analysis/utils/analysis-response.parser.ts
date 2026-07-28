import type { MedicalAnalysisLlmOutput } from '../types';

export class AnalysisResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisResponseParseError';
  }
}

export function extractJsonFromLlmResponse(content: string): string {
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new AnalysisResponseParseError(
    'LLM response does not contain valid JSON',
  );
}

export function parseMedicalAnalysisJson(
  content: string,
): MedicalAnalysisLlmOutput {
  const jsonText = extractJsonFromLlmResponse(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AnalysisResponseParseError('Failed to parse LLM JSON output');
  }

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
