import { extractSocialLeads } from './social-leads';

describe('extractSocialLeads', () => {
  it('reads LinkedIn and X URLs and @handles from a grounded answer', () => {
    const text = `Dr. Steven E. Nissen, a prominent cardiologist at Cleveland Clinic, does not maintain active personal public social media accounts (such as a public X/Twitter or personal LinkedIn profile). You can follow his official work through X / Twitter: @ClevelandClinic or @clevelandclinic and LinkedIn: https://www.linkedin.com/company/cleveland-clinic`;
    const found = extractSocialLeads(text);
    expect(found.map((item) => item.url)).toEqual(
      expect.arrayContaining([
        'https://www.linkedin.com/company/cleveland-clinic',
        'https://x.com/ClevelandClinic',
      ]),
    );
    expect(found.every((item) => /Nissen/i.test(item.context))).toBe(true);
  });

  it('does not treat an email as a Twitter handle', () => {
    expect(
      extractSocialLeads(
        'Contact Dr. Nissen at nissen@clinic.org for speaking.',
      ),
    ).toEqual([]);
  });
});
