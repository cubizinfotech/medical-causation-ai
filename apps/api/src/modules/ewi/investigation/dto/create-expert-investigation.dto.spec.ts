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
