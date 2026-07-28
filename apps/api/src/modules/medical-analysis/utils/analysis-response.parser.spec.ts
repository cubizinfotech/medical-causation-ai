import {
  parseMedicalAnalysisJson,
  extractJsonFromLlmResponse,
} from './analysis-response.parser';

describe('analysis-response.parser', () => {
  it('should extract JSON from fenced code block', () => {
    const json = extractJsonFromLlmResponse(
      '```json\n{"executiveSummary":"test"}\n```',
    );
    const parsed = JSON.parse(json) as { executiveSummary: string };
    expect(parsed.executiveSummary).toBe('test');
  });

  it('should parse medical analysis output', () => {
    const output = parseMedicalAnalysisJson(
      JSON.stringify({
        executiveSummary: 'Summary',
        patientSummary: 'Patient',
        medicalQuestion: 'Question?',
        retrievedEvidence: [],
        supportingEvidence: [],
        opposingEvidence: [],
        aiReasoning: 'Reasoning',
        confidenceScore: 65,
        confidenceExplanation: 'Moderate evidence',
        limitations: ['Limited studies'],
        conclusion: 'Possible association',
        citations: [],
      }),
    );

    expect(output.confidenceScore).toBe(65);
    expect(output.executiveSummary).toBe('Summary');
  });
});
