import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDemandLetterDto } from './create-demand-letter.dto';

/** The global ValidationPipe options in main.ts. */
async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateDemandLetterDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

/** What the website's toDemandLetterRequest() sends. */
const fromWebsite = {
  clientName: 'Jane Doe',
  dateOfLoss: '2024-08-14',
  insuredName: 'John Driver',
  recipientAddress: 'PO Box 1\nPhoenix, AZ 85001',
  incidentDescription: 'Your insured rear-ended our client at a red light.',
  lostWages: 2400.5,
  demandAmount: 45000,
  responseDays: 30,
  attorneyName: 'Alex Counsel',
  attorneyEmail: 'alex@example.com',
  useAi: true,
};

describe('CreateDemandLetterDto', () => {
  it('accepts the request the website sends', async () => {
    expect(await errorsFor(fromWebsite)).toEqual([]);
  });

  it('rejects bad values and unknown fields', async () => {
    expect(
      await errorsFor({
        ...fromWebsite,
        clientName: '',
        dateOfLoss: '08/14/2024',
        demandAmount: 0,
        lostWages: 10.123,
        responseDays: 365,
        attorneyEmail: 'not-an-email',
        notes: 'not a field',
      }),
    ).toEqual(
      expect.arrayContaining([
        'clientName',
        'dateOfLoss',
        'demandAmount',
        'lostWages',
        'responseDays',
        'attorneyEmail',
        'notes',
      ]),
    );
  });
});
