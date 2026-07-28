import { MedicalQueryBuilder } from './medical-query.builder';

describe('MedicalQueryBuilder', () => {
  const builder = new MedicalQueryBuilder();

  it('should build retrieval request from medical analysis request', () => {
    const request = builder.buildRetrievalRequest({
      medicalQuestion: 'Can mild TBI increase stroke risk?',
      injury: 'Mild traumatic brain injury',
      diagnosis: 'Stroke',
    });

    expect(request.question).toBe('Can mild TBI increase stroke risk?');
    expect(request.injury).toBe('Mild traumatic brain injury');
    expect(request.diagnosis).toBe('Stroke');
  });

  it('should build case context from patient fields', () => {
    const context = builder.buildCaseContext({
      medicalQuestion: 'Question?',
      injury: 'TBI',
      diagnosis: 'Stroke',
    });

    expect(context).toContain('Injury/Trauma: TBI');
    expect(context).toContain('Diagnosis: Stroke');
  });
});
