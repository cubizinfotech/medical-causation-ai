import {
  extractPromptVariables,
  renderPromptTemplate,
  estimateTokenCount,
  estimateCostUsd,
} from './prompt-template.util';

describe('prompt-template.util', () => {
  describe('extractPromptVariables', () => {
    it('should extract variable names from a template', () => {
      const template = 'Hello {{name}}, your case {{caseId}} is ready.';
      expect(extractPromptVariables(template)).toEqual(['name', 'caseId']);
    });

    it('should return empty array when no variables present', () => {
      expect(extractPromptVariables('No variables here.')).toEqual([]);
    });
  });

  describe('renderPromptTemplate', () => {
    it('should replace variables in a template', () => {
      const template = 'Injury: {{injuryType}}, Accident: {{accidentType}}';
      const result = renderPromptTemplate(template, {
        injuryType: 'Stroke',
        accidentType: 'MVC',
      });
      expect(result).toBe('Injury: Stroke, Accident: MVC');
    });

    it('should throw when required variables are missing', () => {
      expect(() => renderPromptTemplate('Hello {{name}}', {})).toThrow(
        'Missing required prompt variables: name',
      );
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate tokens from text length', () => {
      expect(estimateTokenCount('abcd')).toBe(1);
      expect(estimateTokenCount('a'.repeat(8))).toBe(2);
    });
  });

  describe('estimateCostUsd', () => {
    it('should calculate estimated cost', () => {
      const cost = estimateCostUsd(1000, 500, 0.01, 0.03);
      expect(cost).toBe(0.025);
    });
  });
});
