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
    .replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '')
    .replace(/```thinking[\s\S]*?```/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function repairCommonJsonIssues(jsonText: string): string {
  return jsonText.replace(/^\uFEFF/, '').replace(/,\s*([}\]])/g, '$1');
}

function findBalancedJsonObjects(text: string): string[] {
  const results: string[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];

      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          results.push(text.slice(i, j + 1));
          break;
        }
      }
    }
  }

  return results;
}

function tryParseJsonObject(jsonText: string): unknown | null {
  const candidates = [jsonText, repairCommonJsonIssues(jsonText)];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // try next repair strategy
    }
  }

  return null;
}

function hasRequiredAnalysisFields(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.executiveSummary === 'string' &&
    record.executiveSummary.length > 0 &&
    typeof record.conclusion === 'string' &&
    record.conclusion.length > 0
  );
}

function selectBestParsedObject(
  candidates: unknown[],
): Record<string, unknown> | null {
  const objects = candidates.filter(
    (candidate): candidate is Record<string, unknown> =>
      candidate !== null &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate),
  );

  const withRequiredFields = objects.filter(hasRequiredAnalysisFields);
  if (withRequiredFields.length > 0) {
    return withRequiredFields.reduce((best, current) =>
      JSON.stringify(current).length > JSON.stringify(best).length
        ? current
        : best,
    );
  }

  if (objects.length === 0) {
    return null;
  }

  return objects.reduce((best, current) =>
    JSON.stringify(current).length > JSON.stringify(best).length
      ? current
      : best,
  );
}

function collectJsonCandidates(trimmed: string): unknown[] {
  const candidates: unknown[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJsonObject(fenced[1].trim());
    if (parsed) {
      candidates.push(parsed);
    }
  }

  for (const objectText of findBalancedJsonObjects(trimmed)) {
    const parsed = tryParseJsonObject(objectText);
    if (parsed) {
      candidates.push(parsed);
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = tryParseJsonObject(trimmed.slice(start, end + 1));
    if (parsed) {
      candidates.push(parsed);
    }
  }

  return candidates;
}

export function extractJsonFromLlmResponse(content: string): string {
  const trimmed = stripModelReasoning(content.trim());

  if (!trimmed) {
    throw new AnalysisResponseParseError('LLM returned an empty response');
  }

  const best = selectBestParsedObject(collectJsonCandidates(trimmed));
  if (best) {
    return JSON.stringify(best);
  }

  throw new AnalysisResponseParseError(
    'LLM response does not contain valid JSON',
  );
}

export function parseMedicalAnalysisJson(
  content: string,
): MedicalAnalysisLlmOutput {
  const jsonText = extractJsonFromLlmResponse(content);
  const parsed = tryParseJsonObject(jsonText);

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
