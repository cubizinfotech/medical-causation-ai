import { parsePersonName } from '../expert-research/live/person-name';
import { assessIdentity, type IdentitySubject } from './identity-assess';

const subject = (over: Partial<IdentitySubject> = {}): IdentitySubject => ({
  name: parsePersonName('Jason A. Demery') as NonNullable<
    ReturnType<typeof parsePersonName>
  >,
  city: 'Ocala, FL',
  specialty: 'Physical medicine and rehabilitation',
  ...over,
});

describe('assessIdentity', () => {
  it('is strong when the full name sits next to the profession and place', () => {
    const result = assessIdentity(
      {
        text: 'Dr. Jason Demery, a physical medicine and rehabilitation physician in Ocala, testified on Tuesday.',
      },
      subject(),
    );
    expect(result.nameMatch).toBe('full');
    expect(result.level).toBe('strong');
    expect(result.corroboration.specialty).toBe(true);
    expect(result.corroboration.city).toBe(true);
    expect(result.quote).toContain('Jason Demery');
  });

  it('keeps a bare same-name page weak instead of attributing it', () => {
    const result = assessIdentity(
      {
        text: 'Jason Demery won the local fishing tournament with a 12 pound bass.',
      },
      subject(),
    );
    expect(result.nameMatch).toBe('full');
    expect(result.level).toBe('weak');
    expect(result.confidence).toBe('low');
  });

  it('treats a different middle initial as another person', () => {
    const result = assessIdentity(
      { text: 'Attorney Jason B. Demery filed the brief in Dallas.' },
      subject(),
    );
    expect(result.level).toBe('other_person');
    expect(result.conflicts[0]).toMatch(/middle/);
  });

  it('does not match a different first name with the same surname', () => {
    const result = assessIdentity(
      {
        text: 'Mark Demery is a physical medicine and rehabilitation physician in Ocala.',
      },
      subject(),
    );
    expect(result.nameMatch).toBe('none');
    expect(result.level).toBe('other_person');
  });

  it('keeps a surname-only page weak even when specialty and city match', () => {
    const result = assessIdentity(
      {
        text: 'Ellenberg offers pediatric neuropsychology in Los Angeles.',
      },
      {
        name: parsePersonName('Leah Ellenberg') as NonNullable<
          ReturnType<typeof parsePersonName>
        >,
        city: 'Los Angeles, CA',
        specialty: 'Neuropsychology',
      },
    );
    expect(result.nameMatch).toBe('surname_only');
    expect(result.level).toBe('weak');
  });

  it('treats Leila vs Leah as another person, not a possible match', () => {
    const result = assessIdentity(
      {
        text: 'Leila Ellenberg, PhD is a pediatric neuropsychologist in Los Angeles.',
      },
      {
        name: parsePersonName('Leah Ellenberg') as NonNullable<
          ReturnType<typeof parsePersonName>
        >,
        city: 'Los Angeles, CA',
        specialty: 'Neuropsychology',
      },
    );
    expect(result.level).toBe('other_person');
    expect(result.conflicts[0]).toMatch(/Leila/i);
  });

  it('accepts last-name-first and initial forms', () => {
    expect(
      assessIdentity(
        { text: 'Demery, Jason A. - Ocala - Physical Medicine' },
        subject(),
      ).nameMatch,
    ).toBe('full');
    expect(
      assessIdentity({ text: 'J. Demery, MD, Ocala' }, subject()).nameMatch,
    ).toBe('initial');
  });

  it('caps a snippet-only page below strong', () => {
    const result = assessIdentity(
      {
        text: 'Jason Demery, physical medicine and rehabilitation, Ocala',
      },
      subject(),
      { limitedText: true },
    );
    expect(result.level).toBe('possible');
    expect(result.confidence).toBe('low');
  });

  it('uses the NPI as strong corroboration', () => {
    const result = assessIdentity(
      { text: 'Jason Demery NPI 1234567890 profile' },
      subject({ npi: '1234567890' }),
    );
    expect(result.level).toBe('strong');
  });

  it('works for a profession that is not medical', () => {
    const result = assessIdentity(
      {
        text: 'Maria Lopez, a structural engineer in Tampa, reviewed the bridge plans.',
      },
      {
        name: parsePersonName('Maria Lopez') as NonNullable<
          ReturnType<typeof parsePersonName>
        >,
        city: 'Tampa, FL',
        specialty: 'Structural engineer',
      },
    );
    expect(result.level).toBe('strong');
  });

  it('uses intake note terms as corroboration', () => {
    const result = assessIdentity(
      {
        text: 'Jason Demery of Marion Rehab Associates spoke at the conference.',
      },
      subject({
        city: '',
        specialty: 'Physiatrist',
        context: 'Works at "Marion Rehab Associates"',
      }),
    );
    expect(result.corroboration.context.length).toBeGreaterThan(0);
    expect(result.level).toBe('possible');
  });
});
