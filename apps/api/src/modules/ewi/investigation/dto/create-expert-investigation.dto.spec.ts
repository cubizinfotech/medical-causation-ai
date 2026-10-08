import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExpertInvestigationDto } from './create-expert-investigation.dto';

describe('CreateExpertInvestigationDto', () => {
  it('keeps a custom medical specialty as the submitted string', async () => {
    const dto = plainToInstance(CreateExpertInvestigationDto, {
      expertName: 'Jane A. Smith, MD',
      city: 'Boston',
      specialty: 'Neuropsychology',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.specialty).toBe('Neuropsychology');
  });

  it('accepts a valid NPI and rejects a mistyped one', async () => {
    const valid = plainToInstance(CreateExpertInvestigationDto, {
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Neurology',
      npi: ' 1234567893 ',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(valid.npi).toBe('1234567893');

    const mistyped = plainToInstance(CreateExpertInvestigationDto, {
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Neurology',
      npi: '1234567890',
    });
    const errors = await validate(mistyped);
    expect(errors.some((error) => error.property === 'npi')).toBe(true);

    const blank = plainToInstance(CreateExpertInvestigationDto, {
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Neurology',
      npi: '',
    });
    await expect(validate(blank)).resolves.toHaveLength(0);
    expect(blank.npi).toBeUndefined();
  });

  it('rejects a blank specialty', async () => {
    const dto = plainToInstance(CreateExpertInvestigationDto, {
      expertName: 'Jane A. Smith, MD',
      city: 'Boston',
      specialty: ' ',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'specialty')).toBe(true);
  });
});
