import { buildEwiReportDocument } from '../../report/ewi-report.template';
import type { MembershipEntry } from './membership.types';
import { assessMembershipsFromMaterials } from './membership-assessment';
import { resolveOrganization } from './organization-registry';

function entry(
  partial: Partial<MembershipEntry> &
    Pick<MembershipEntry, 'organization' | 'statement'>,
): MembershipEntry {
  return {
    id: partial.id ?? 'mem-1',
    organization: partial.organization,
    membershipType: partial.membershipType ?? 'member',
    statusText: partial.statusText ?? null,
    startYear: partial.startYear ?? null,
    endYear: partial.endYear ?? null,
    designation: partial.designation ?? 'Member',
    statement: partial.statement,
    quote: partial.quote ?? partial.statement,
    page: partial.page ?? 1,
    cvSourceUrl: partial.cvSourceUrl ?? 'https://example.com/cv.pdf',
    claimId: partial.claimId ?? 'c1',
  };
}

const AACN_STRONG = {
  url: 'https://theaacn.org/directory/jane-expert',
  title: 'Jane Expert — AACN Member Directory',
  text: `
    Jane Expert, Ph.D.
    Clinical Neuropsychology
    Tampa, FL
    Member, American Academy of Clinical Neuropsychology
  `,
};

const AACN_NAME_ONLY = {
  url: 'https://theaacn.org/directory/j-expert',
  title: 'Jane Expert',
  text: 'Jane Expert. Member profile.',
};

const AACN_WRONG_CREDENTIAL = {
  url: 'https://theaacn.org/directory/jane-expert-md',
  title: 'Jane Expert, M.D. — Cardiology',
  text: `
    Jane Expert, M.D.
    Cardiology
    Boston, MA
  `,
};

describe('resolveOrganization', () => {
  it('16. does not conflate similar organization names', () => {
    expect(resolveOrganization('American Academy of Clinical Neuropsychology')?.id).toBe(
      'aacn',
    );
    expect(resolveOrganization('National Academy of Neuropsychology')?.id).toBe(
      'nan',
    );
    expect(resolveOrganization('American Psychological Association')?.id).toBe(
      'apa_membership',
    );
    expect(resolveOrganization('Some Random Society')).toBeNull();
  });
});

describe('assessMembershipsFromMaterials', () => {
  it('1. multiple memberships → multiple assessments', () => {
    const dossier = assessMembershipsFromMaterials(
      [
        entry({
          id: 'm1',
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
        entry({
          id: 'm2',
          organization: 'NAN',
          membershipType: 'fellow',
          designation: 'Fellow',
          statement: 'Fellow, NAN',
        }),
      ],
      {
        aacn: [AACN_STRONG],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    );
    expect(dossier.assessments).toHaveLength(2);
  });

  it('2. no memberships → warning', () => {
    const dossier = assessMembershipsFromMaterials(
      [],
      {},
      { expertName: 'Jane Expert' },
    );
    expect(dossier.assessments).toHaveLength(0);
    expect(dossier.warnings.join(' ')).toMatch(/No membership claims/i);
  });

  it('3. official public directory match → verified', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'American Academy of Clinical Neuropsychology',
          statement: 'Member, AACN',
        }),
      ],
      { aacn: [AACN_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    ).assessments[0];
    expect(a.status).toBe('verified');
    expect(a.evidence?.url).toContain('theaacn.org');
  });

  it('4. directory searched, no match → no_matching_record', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
      ],
      {
        aacn: [
          {
            url: 'https://theaacn.org/directory',
            title: 'AACN Directory',
            text: 'Member directory search results. No profiles listed for this query. Other members: Smith, Jones.',
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    ).assessments[0];
    expect(a.status).toBe('no_matching_record');
  });

  it('5. login/CAPTCHA directory → unable_to_access', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'American Psychological Association',
          statement: 'Member, APA',
        }),
      ],
      {
        apa_membership: [
          {
            url: 'https://www.apa.org/membership',
            title: 'APA Membership',
            text: 'Please sign in to continue',
            restricted: true,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Psychology',
        loginBlocked: true,
      },
    ).assessments[0];
    expect(a.status).toBe('unable_to_access');
  });

  it('6. org site unavailable → unable_to_access', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
      ],
      {},
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        allFetchesFailed: true,
      },
    ).assessments[0];
    expect(a.status).toBe('unable_to_access');
  });

  it('7. search API failure → not negative', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
      ],
      {},
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        searchFailed: true,
      },
    ).assessments[0];
    expect(a.status).toBe('not_independently_verified');
    expect(a.status).not.toBe('no_matching_record');
  });

  it('8. same-name directory hit without corroboration → not verified', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
      ],
      { aacn: [AACN_NAME_ONLY] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    ).assessments[0];
    expect(a.status).not.toBe('verified');
    expect(a.status).toBe('not_independently_verified');
  });

  it('9. different professional credential / wrong person cues rejected', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'AACN',
          statement: 'Member, AACN',
        }),
      ],
      { aacn: [AACN_WRONG_CREDENTIAL] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    ).assessments[0];
    // Name matches but specialty/city do not corroborate → not verified.
    expect(a.status).not.toBe('verified');
  });

  it('15. own-site-only / unknown mapping → self_reported', () => {
    const a = assessMembershipsFromMaterials(
      [
        entry({
          organization: 'Regional Psychology Guild of Nowhere',
          statement: 'Member, Regional Psychology Guild of Nowhere',
        }),
      ],
      {},
      { expertName: 'Jane Expert', specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.status).toBe('self_reported');
  });

  it('17. report lists every membership independently', () => {
    const dossier = assessMembershipsFromMaterials(
      [
        entry({
          id: 'm1',
          organization: 'AACN',
          statement: 'Member, American Academy of Clinical Neuropsychology',
        }),
        entry({
          id: 'm2',
          organization: 'NAN',
          membershipType: 'fellow',
          designation: 'Fellow',
          statement: 'Fellow, National Academy of Neuropsychology',
        }),
      ],
      { aacn: [AACN_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
      },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      membershipAssessments: dossier,
    });
    const section = document.sections.find((s) => s.id === 'memberships');
    expect(section).toBeTruthy();
    const text = section!.blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/American Academy of Clinical Neuropsychology/i);
    expect(text).toMatch(/National Academy of Neuropsychology/i);
    expect(text).toMatch(/Verification status:/);
    expect(text).toMatch(/Coverage:/);
  });
});
