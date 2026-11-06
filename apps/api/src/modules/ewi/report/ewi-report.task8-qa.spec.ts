import { buildEwiReportDocument } from './ewi-report.template';
import { uniqueSourceLinks } from './ewi-source-links';
import { EWI_REPORT_TEMPLATE_VERSION } from './ewi-report.version';
import { compareCv } from '../cv/cv-comparison';
import type { CvClaim } from '../cv/cv.types';
import type { AffiliationAssessment } from '../research/affiliations';
import type { BoardCertificationAssessment } from '../research/board-certifications';
import type { MembershipAssessment } from '../research/memberships';
import type { ProgramAccreditationAssessment } from '../research/accreditation';

function baseInput() {
  return {
    expertName: 'Jane Expert',
    city: 'Tampa, FL',
    specialty: 'Clinical Neuropsychology',
    evidence: [
      {
        sourceId: 'npi_registry',
        category: 'identity',
        title: 'NPI',
        summary: 'Identity',
        url: 'https://npiregistry.cms.hhs.gov/1',
        retrievedAt: '2026-11-06T00:00:00.000Z',
        access: 'public' as const,
      },
    ],
    discrepancies: [],
    questions: [],
    generatedAt: '2026-11-06T00:00:00.000Z',
    summary: 'Investigation summary without overstating unverified credentials.',
  };
}

function sectionText(
  document: ReturnType<typeof buildEwiReportDocument>,
  id: string,
): string {
  return (
    document.sections
      .find((section) => section.id === id)
      ?.blocks.map((block) => block.text)
      .join('\n') ?? ''
  );
}

describe('Task 8 report consistency QA', () => {
  it('pins report version 3.10.27', () => {
    expect(EWI_REPORT_TEMPLATE_VERSION).toBe('3.10.27');
    const doc = buildEwiReportDocument(baseInput());
    expect(doc.templateVersion).toBe('3.10.27');
  });

  it('Word and PDF document models share section text and version from the same input', () => {
    const input = baseInput();
    const a = buildEwiReportDocument(input);
    const b = buildEwiReportDocument(input);
    expect(a.templateVersion).toBe(b.templateVersion);
    expect(a.sections.map((s) => s.id)).toEqual(b.sections.map((s) => s.id));
    for (let i = 0; i < a.sections.length; i += 1) {
      const left = a.sections[i].blocks.map((block) => block.text).join('\n');
      const right = b.sections[i].blocks.map((block) => block.text).join('\n');
      expect(left).toBe(right);
    }
  });

  it('Exec Summary does not overstate Self-Reported board or Not Checked directories', () => {
    const boardAssessments = {
      assessedAt: '2026-11-06T00:00:00.000Z',
      assessments: [
        {
          id: 'bc1',
          entry: {
            id: 'e1',
            credentialName: 'ABPP',
            boardName: 'ABPP',
            boardId: 'abpp',
            specialty: null,
            certificationDate: null,
            expirationOrStatus: null,
            certificationNumber: null,
            statement: 'Board certified ABPP',
            quote: 'Board certified ABPP',
            page: 1,
            cvSourceUrl: null,
            claimId: 'c1',
            extractionConfidence: 'high' as const,
          },
          status: 'self_reported' as const,
          boardCanonical: 'ABPP',
          officialWebsite: 'https://abpp.org',
          verificationUrl: null,
          access: null,
          evidence: null,
          queriesRun: [],
          explanation: 'Self-Reported',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        } satisfies BoardCertificationAssessment,
      ],
      warnings: [],
    };
    const directoryAssessments = {
      assessedAt: '2026-11-06T00:00:00.000Z',
      assessments: [
        {
          id: 'd1',
          directoryId: 'seak',
          directoryName: 'SEAK',
          directoryType: 'expert_witness_directory' as const,
          homeUrl: 'https://seakexperts.com',
          status: 'not_checked' as const,
          searchMethod: 'site_serp' as const,
          access: 'public_directory' as const,
          profileUrl: null,
          evidence: null,
          queriesRun: [],
          explanation: 'Not Checked',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        },
      ],
      warnings: [],
    };
    const doc = buildEwiReportDocument({
      ...baseInput(),
      boardCertificationAssessments: boardAssessments,
      directoryAssessments,
    });
    const summary = sectionText(doc, 'summary');
    expect(summary).toMatch(/Self-Reported|Not Independently Verified|Not Checked/i);
    expect(summary).toMatch(/Expert Witness Advertising|Not Checked/i);
    expect(summary).not.toMatch(/independently confirmed board certification/i);
  });

  it('Source Index and Source Links include membership and accreditation evidence URLs', () => {
    const membershipAssessments = {
      assessedAt: '2026-11-06T00:00:00.000Z',
      assessments: [
        {
          id: 'm1',
          entry: {
            id: 'me1',
            organization: 'AACN',
            membershipType: 'member' as const,
            statusText: null,
            startYear: null,
            endYear: null,
            designation: 'Member',
            statement: 'Member, AACN',
            quote: 'Member, AACN',
            page: 1,
            cvSourceUrl: null,
            claimId: 'cm1',
          },
          status: 'verified' as const,
          organizationCanonical: 'AACN',
          officialWebsite: 'https://theaacn.org',
          directoryUrl: 'https://theaacn.org/directory',
          access: 'public_directory' as const,
          evidence: {
            url: 'https://theaacn.org/directory/jane',
            title: 'Jane Expert',
            excerpt: 'Member',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            host: 'theaacn.org',
            identityLevel: 'strong' as const,
          },
          queriesRun: [],
          explanation: 'Verified',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        } satisfies MembershipAssessment,
      ],
      warnings: [],
    };
    const accreditation = {
      assessedAt: '2026-11-06T00:00:00.000Z',
      assessments: [
        {
          id: 'a1',
          entry: {
            id: 'ed1',
            institution: 'Sample State University',
            degreeName: 'Ph.D.',
            degreeKind: 'doctoral' as const,
            program: null,
            fieldOfStudy: null,
            startYear: null,
            endYear: null,
            graduationYear: 2010,
            campus: null,
            statement: 'Ph.D., Sample State University',
            quote: 'Ph.D., Sample State University',
            page: 1,
            cvSourceUrl: null,
            claimId: 'ce1',
          },
          apaStatus: 'currently_accredited' as const,
          institutionalStatus: 'currently_accredited' as const,
          apaEvidence: {
            kind: 'apa_program' as const,
            url: 'https://accreditation.apa.org/sample',
            title: 'APA CoA',
            excerpt: 'Accredited',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            accreditedFromYear: null,
            accreditedToYear: null,
            currentlyListed: true,
          },
          institutionalEvidence: {
            kind: 'institutional' as const,
            url: 'https://www.chea.org/sample',
            title: 'CHEA',
            excerpt: 'Accredited',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            accreditedFromYear: null,
            accreditedToYear: null,
            currentlyListed: true,
          },
          queriesRun: [],
          explanation: 'Accredited',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        } satisfies ProgramAccreditationAssessment,
      ],
      warnings: [],
    };
    const doc = buildEwiReportDocument({
      ...baseInput(),
      membershipAssessments,
      accreditation,
    });
    const index = sectionText(doc, 'source-index');
    expect(index).toMatch(/collected evidence items|Source Index lists unique/i);
    expect(index).toMatch(/theaacn\.org|AACN/i);
    expect(index).toMatch(/accreditation\.apa\.org|chea\.org/i);

    const links = uniqueSourceLinks({
      membershipAssessments,
      accreditation,
    });
    expect(links.some((l) => /aacn/i.test(l.url))).toBe(true);
    expect(links.some((l) => /apa\.org|chea\.org/i.test(l.url))).toBe(true);
  });

  it('CV re-compare with affiliation assessment updates appointment labels', () => {
    const claim: CvClaim = {
      id: 'appt-1',
      category: 'appointment',
      statement: 'Clinical Assistant Professor, University of South Florida',
      details: {
        title: 'Clinical Assistant Professor',
        institution: 'University of South Florida',
      },
      page: 1,
      quote: 'Clinical Assistant Professor, University of South Florida',
    };
    const assessment: AffiliationAssessment = {
      id: 'aa',
      entry: {
        id: 'affil-1',
        institution: 'University of South Florida',
        department: null,
        title: 'Clinical Assistant Professor',
        relationshipType: 'clinical_appointment',
        timeframe: 'current',
        startYear: 2018,
        endYear: null,
        location: null,
        statement: claim.statement,
        quote: claim.quote,
        page: 1,
        cvSourceUrl: null,
        claimId: 'appt-1',
        class: 'appointment',
        extractionConfidence: 'high',
      },
      status: 'independently_verified',
      institutionCanonical: 'University of South Florida',
      evidence: {
        url: 'https://www.usf.edu/faculty/jane',
        title: 'Faculty',
        excerpt: 'Jane Expert Clinical Assistant Professor',
        retrievedAt: '2026-11-06T00:00:00.000Z',
        host: 'usf.edu',
        identityLevel: 'strong',
        searchResultOnly: false,
        trainingDocument: false,
      },
      queriesRun: [],
      explanation: 'Independently Verified',
      limitations: [],
      retrievedAt: '2026-11-06T00:00:00.000Z',
    };
    const without = compareCv({
      extraction: {
        document: {
          id: 'doc',
          name: 'cv.pdf',
          pageCount: 1,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [claim],
        warnings: [],
      },
      evidence: [],
      sourceResults: [],
      identity: null,
      publications: [],
    });
    const withAssess = compareCv({
      extraction: {
        document: {
          id: 'doc',
          name: 'cv.pdf',
          pageCount: 1,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [claim],
        warnings: [],
      },
      evidence: [],
      sourceResults: [],
      identity: null,
      publications: [],
      affiliationAssessments: [assessment],
    });
    expect(
      without.comparisons.find((c) => c.topic === 'appointment')?.label,
    ).toBe('not_verified');
    expect(
      withAssess.comparisons.find((c) => c.topic === 'appointment')?.label,
    ).toBe('verified');
  });

  it('collected-item count glossary appears in Source Index', () => {
    const doc = buildEwiReportDocument(baseInput());
    expect(sectionText(doc, 'source-index')).toMatch(
      /not the same metric|collected evidence items/i,
    );
  });
});
