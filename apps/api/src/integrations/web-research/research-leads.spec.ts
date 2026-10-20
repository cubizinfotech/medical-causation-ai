import { extractResearchLeads, institutionsFromText } from './research-leads';

describe('extractResearchLeads', () => {
  it('picks named programs, funders and institutions from Gemini prose', () => {
    const leads = extractResearchLeads([
      'Dr. Demery contributed to TRACK-TBI, which receives support from the National Institutes of Health (NIH) and the U.S. Department of Defense. He trained at the University of Florida.',
    ]);
    expect(leads.programs).toContain('TRACK-TBI');
    expect(leads.funders).toEqual(expect.arrayContaining(['NIH', 'DoD']));
    expect(leads.institutions).toContain('University of Florida');
  });
});

describe('institutionsFromText', () => {
  it('does not keep a sentence fragment as a school name', () => {
    expect(
      institutionsFromText('University of Florida. He later moved.'),
    ).toEqual(['University of Florida']);
  });
});
