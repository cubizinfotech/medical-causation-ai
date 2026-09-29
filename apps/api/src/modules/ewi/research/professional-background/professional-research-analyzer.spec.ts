import {
  buildProfessionalBackgroundDossier,
  hasEstimatedPercentage,
} from './professional-research-analyzer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';

function item(
  partial: Pick<ExpertEvidenceItem, 'sourceId' | 'category' | 'title'> &
    Partial<ExpertEvidenceItem>,
): ExpertEvidenceItem {
  return {
    summary: 'Collected professional statement',
    access: 'public',
    informationStatus: 'unverified',
    identityMatch: 'matched',
    ...partial,
  };
}

describe('professional background research', () => {
  it('captures grant participation fields and marks unavailable private results', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'grants',
          category: 'grant',
          title: 'NIH grant',
          url: 'https://reporter.nih.gov/example',
          raw: {
            professionalKind: 'grant',
            name: 'Jane Expert',
            title: 'Outcomes study',
            identifier: 'R01-NS1',
            role: 'Principal Investigator',
            participation: 'Named investigator',
            authorship: 'Lead investigator',
            institution: 'Example University',
            startDate: '2018-01-01',
            endDate: '2022-12-31',
            resultsAvailable: true,
            resultUrl: 'https://reporter.nih.gov/example/results',
          },
        }),
        item({
          sourceId: 'grant_results',
          category: 'grant',
          title: 'Private foundation',
          raw: {
            professionalKind: 'grant_result',
            identifier: 'PF-1',
            resultsAvailable: false,
            resultsUnavailableReason:
              'Private foundation results were unavailable.',
          },
        }),
      ],
    });

    expect(dossier.grants[0]).toMatchObject({
      identifier: 'R01-NS1',
      role: 'Principal Investigator',
      institution: 'Example University',
      resultUrl: 'https://reporter.nih.gov/example/results',
    });
    expect(dossier.grants[1]?.resultsAvailable).toBe(false);
    expect(dossier.grants[1]?.resultsUnavailableReason).toMatch(/unavailable/i);
  });

  it('verifies patent and trademark identity fields without inventing marks', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'patents',
          category: 'patent',
          title: 'Patent',
          url: 'https://patents.example/US1',
          raw: {
            professionalKind: 'patent',
            name: 'Jane Expert',
            title: 'Device',
            identifier: 'US1',
            filingDate: '2016-05-01',
            status: 'Granted',
            role: 'Inventor',
          },
        }),
      ],
      sourceResults: [
        {
          sourceId: 'trademarks',
          status: 'no_result',
          outcome: 'no_result',
          access: 'public',
          message: 'No trademark was returned.',
          retrievedAt: '2026-09-29T00:00:00.000Z',
          items: [],
        },
      ],
      professionalProviderIds: ['patents', 'trademarks'],
    });

    expect(dossier.patentsAndTrademarks[0]).toMatchObject({
      identifier: 'US1',
      filingDate: '2016-05-01',
      status: 'Granted',
      role: 'Inventor',
    });
    expect(dossier.sourceAttempts[0]).toMatchObject({
      sourceId: 'trademarks',
      status: 'no_result',
    });
  });

  it('records military claims from public sources without unsupported conclusions', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'military_claims',
          category: 'military',
          title: 'Medal reference',
          url: 'https://example.local/medal',
          raw: {
            professionalKind: 'military_medal',
            medal: 'Commendation Medal',
            title: 'Commendation Medal reference',
            verificationNote:
              'Public index entry only. No unsupported conclusion about military service was drawn.',
          },
        }),
      ],
    });

    expect(dossier.militaryClaims[0]?.kind).toBe('military_medal');
    expect(dossier.militaryClaims[0]?.verificationNote).toMatch(
      /no unsupported conclusion/i,
    );
    expect(dossier.militaryClaims[0]?.summary).not.toMatch(
      /served with distinction|hero/i,
    );
  });

  it('compares membership CV claims with public organization records', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'memberships',
          category: 'membership',
          title: 'Membership',
          raw: {
            professionalKind: 'membership',
            organization: 'Example Medical Society',
            cvClaim: 'Fellow, Example Medical Society',
            publicRecord: 'Listed as a member',
            status: 'Active',
          },
        }),
        item({
          sourceId: 'professional_organizations',
          category: 'membership',
          title: 'Organization',
          raw: {
            professionalKind: 'professional_organization',
            organization: 'Example Specialty College',
            cvClaim: 'Fellow, Example Specialty College',
            publicRecord: 'Appears on the public fellow roster',
          },
        }),
      ],
    });

    expect(dossier.memberships[0]?.cvClaim).toMatch(/Fellow/);
    expect(dossier.memberships[0]?.publicRecord).toMatch(/Listed/);
    expect(dossier.organizations[0]?.organization).toBe(
      'Example Specialty College',
    );
  });

  it('presents financial information chronologically without inventing percentages or bias', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'open_payments',
          category: 'income_bias',
          title: 'Fee disclosure',
          raw: {
            professionalKind: 'forensic_income',
            paymentDate: '2023-01-01',
            hourlyRate: '450',
            forensicWork: 'IME work',
            defenseWork: 'Defense retainers',
            percentForensicWork: '40',
            percentDefenseWork: '60',
            neutralSummary:
              'Percentages are taken from the disclosed record. No bias conclusion is drawn from payment alone.',
          },
        }),
        item({
          sourceId: 'open_payments',
          category: 'income_bias',
          title: 'Open Payments',
          raw: {
            professionalKind: 'open_payments',
            paymentDate: '2021-03-15',
            paymentAmount: '1250.00',
            payer: 'Example Pharma',
            natureOfPayment: 'Consulting fee',
          },
        }),
      ],
    });

    expect(dossier.financial.map((entry) => entry.paymentDate)).toEqual([
      '2021-03-15',
      '2023-01-01',
    ]);
    expect(dossier.financial[1]?.percentForensicWork).toBe('40');
    expect(hasEstimatedPercentage(dossier.financial[1])).toBe(false);
    expect(
      dossier.financial.map((entry) => entry.summary).join(' '),
    ).not.toMatch(/biased|bought|corrupt/i);
  });

  it('does not merge uncertain identity professional records', () => {
    const dossier = buildProfessionalBackgroundDossier({
      evidence: [
        item({
          sourceId: 'patents',
          category: 'patent',
          title: 'Other person patent',
          identityMatch: 'uncertain',
          raw: { professionalKind: 'patent', identifier: 'US9' },
        }),
      ],
    });
    expect(dossier.records).toEqual([]);
  });
});
