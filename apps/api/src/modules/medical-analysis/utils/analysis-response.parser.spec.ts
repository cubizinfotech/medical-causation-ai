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

  it('should strip reasoning tags before parsing JSON', () => {
    const output = parseMedicalAnalysisJson(
      'internal reasoning' +
        JSON.stringify({
          executiveSummary: 'Summary',
          conclusion: 'Conclusion',
        }),
    );

    expect(output.executiveSummary).toBe('Summary');
    expect(output.conclusion).toBe('Conclusion');
  });

  it('should parse JSON wrapped in prose', () => {
    const output = parseMedicalAnalysisJson(
      'Here is the analysis:\n' +
        JSON.stringify({
          executiveSummary: 'Summary',
          conclusion: 'Conclusion',
        }) +
        '\nEnd of response.',
    );

    expect(output.executiveSummary).toBe('Summary');
    expect(output.conclusion).toBe('Conclusion');
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

  it('should prefer root analysis object over nested citation objects', () => {
    const output = parseMedicalAnalysisJson(
      JSON.stringify({
        executiveSummary: 'Summary',
        patientSummary: 'Patient',
        medicalQuestion: 'Question?',
        retrievedEvidence: [
          {
            chunkId: 'chunk-1',
            excerpt: 'Evidence excerpt',
            classification: 'supporting',
            classificationReasoning: 'Supports causation',
          },
        ],
        supportingEvidence: [],
        opposingEvidence: [],
        aiReasoning: 'Reasoning',
        confidenceScore: 65,
        confidenceExplanation: 'Moderate evidence',
        limitations: ['Limited studies'],
        conclusion: 'Possible association',
        citations: [{ chunkId: 'chunk-1', statement: 'Supported claim' }],
      }),
    );

    expect(output.executiveSummary).toBe('Summary');
    expect(output.conclusion).toBe('Possible association');
    expect(output.citations).toHaveLength(1);
  });
});
