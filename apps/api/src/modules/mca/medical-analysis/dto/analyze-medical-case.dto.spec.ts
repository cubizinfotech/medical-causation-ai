import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnalyzeMedicalCaseDto } from './analyze-medical-case.dto';

const validCase = {
  patientAge: '47',
  patientGender: 'male',
  accidentDate: '2023-09-14',
  accidentType: 'Motor Vehicle Collision',
  accidentDescription: 'Rear-end collision with immediate neck pain.',
  diagnosis: 'Cervical strain',
  symptoms: 'Neck pain and headache',
  medicalHistory: 'None relevant',
  medications: '',
  timeline: '',
  medicalQuestion: 'Did the collision materially cause the cervical strain?',
};

describe('AnalyzeMedicalCaseDto', () => {
  it('accepts a case without a patient name', async () => {
    const dto = plainToInstance(AnalyzeMedicalCaseDto, validCase);
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).not.toHaveProperty('patientName');
  });

  it('rejects a payload that still includes a patient name', async () => {
    const dto = plainToInstance(AnalyzeMedicalCaseDto, {
      ...validCase,
      patientName: 'Should not be sent',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((error) => error.property === 'patientName')).toBe(true);
  });

  it('rejects a missing medical question', async () => {
    const dto = plainToInstance(AnalyzeMedicalCaseDto, {
      ...validCase,
      medicalQuestion: '   ',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'medicalQuestion')).toBe(
      true,
    );
  });

  it('rejects missing required clinical fields', async () => {
    const dto = plainToInstance(AnalyzeMedicalCaseDto, {
      ...validCase,
      patientAge: '',
      diagnosis: '',
    });
    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['patientAge', 'diagnosis']),
    );
  });
});
