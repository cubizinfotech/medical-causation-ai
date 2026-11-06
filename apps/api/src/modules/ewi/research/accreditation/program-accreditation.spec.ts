import { buildEwiReportDocument } from '../../report/ewi-report.template';
import type { EducationDegreeEntry } from './accreditation.types';
import { assessProgramAccreditationFromMaterials } from './program-accreditation';

function entry(
  partial: Partial<EducationDegreeEntry> &
    Pick<EducationDegreeEntry, 'institution' | 'statement'>,
): EducationDegreeEntry {
  return {
    id: partial.id ?? 'edu-1',
    institution: partial.institution,
    degreeName: partial.degreeName ?? null,
    degreeKind: partial.degreeKind ?? 'doctoral',
    program: partial.program ?? null,
    fieldOfStudy: partial.fieldOfStudy ?? null,
    startYear: partial.startYear ?? null,
    endYear: partial.endYear ?? null,
    graduationYear: partial.graduationYear ?? null,
    campus: partial.campus ?? null,
    statement: partial.statement,
    quote: partial.quote ?? partial.statement,
    page: partial.page ?? 1,
    cvSourceUrl: partial.cvSourceUrl ?? 'https://example.com/cv.pdf',
    claimId: partial.claimId ?? 'c1',
  };
}

const APA_CLINICAL = {
  kind: 'apa_program' as const,
  url: 'https://accreditation.apa.org/programs/usf-clinical',
  title: 'University of South Florida — Clinical Psychology PhD',
  text: `
    University of South Florida
    Clinical Psychology Ph.D. program
    Currently accredited. Accredited since 1981.
  `,
};

const APA_HISTORICAL = {
  kind: 'apa_program' as const,
  url: 'https://accreditation.apa.org/programs/example-clinical',
  title: 'Example University — Clinical Psychology',
  text: `
    Example University Clinical Psychology doctoral program
    Accredited 1995–2010.
  `,
};

const APA_NOT_DURING = {
  kind: 'apa_program' as const,
  url: 'https://accreditation.apa.org/programs/late-start',
  title: 'Late Start University — Clinical Psychology',
  text: `
    Late Start University Clinical Psychology Ph.D.
    Accredited since 2015.
  `,
};

const CHEA_USF = {
  kind: 'institutional' as const,
  url: 'https://www.chea.org/university-of-south-florida',
  title: 'University of South Florida — CHEA',
  text: `
    University of South Florida is currently accredited by a CHEA-recognized accreditor.
  `,
};

const APA_OTHER_SCHOOL = {
  kind: 'apa_program' as const,
  url: 'https://accreditation.apa.org/programs/other',
  title: 'University of Southern Florida State — Counseling Psychology',
  text: `
    University of Southern Florida State Counseling Psychology Psy.D.
    Currently accredited.
  `,
};

describe('assessProgramAccreditationFromMaterials', () => {
  it('1. assesses one doctoral degree', () => {
    const dossier = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          degreeName: 'Ph.D.',
          program: 'Clinical Psychology',
          fieldOfStudy: 'Clinical Psychology',
          graduationYear: 2008,
          statement: 'Ph.D., Clinical Psychology, USF, 2008',
        }),
      ],
      [APA_CLINICAL, CHEA_USF],
      { specialty: 'Clinical Psychology' },
    );
    expect(dossier.assessments).toHaveLength(1);
    expect(dossier.assessments[0].apaStatus).toMatch(
      /accredited_during_period|currently_accredited/,
    );
    expect(dossier.assessments[0].apaEvidence?.url).toContain(
      'accreditation.apa.org',
    );
  });

  it('2. three degrees / three universities → three assessments', () => {
    const dossier = assessProgramAccreditationFromMaterials(
      [
        entry({
          id: 'e1',
          institution: 'University of Florida',
          degreeName: 'B.A.',
          degreeKind: 'bachelors',
          graduationYear: 2000,
          statement: 'B.A., University of Florida',
        }),
        entry({
          id: 'e2',
          institution: 'University of Central Florida',
          degreeName: 'M.A.',
          degreeKind: 'masters',
          graduationYear: 2003,
          statement: 'M.A., UCF',
        }),
        entry({
          id: 'e3',
          institution: 'University of South Florida',
          degreeName: 'Ph.D.',
          program: 'Clinical Psychology',
          graduationYear: 2008,
          statement: 'Ph.D., USF',
        }),
      ],
      [APA_CLINICAL, CHEA_USF],
      { specialty: 'Clinical Psychology' },
    );
    expect(dossier.assessments).toHaveLength(3);
  });

  it('3. multiple degrees, same university', () => {
    const dossier = assessProgramAccreditationFromMaterials(
      [
        entry({
          id: 'e1',
          institution: 'University of South Florida',
          degreeName: 'M.A.',
          degreeKind: 'masters',
          graduationYear: 2004,
          statement: 'M.A., USF',
        }),
        entry({
          id: 'e2',
          institution: 'University of South Florida',
          degreeName: 'Ph.D.',
          program: 'Clinical Psychology',
          graduationYear: 2008,
          statement: 'Ph.D., USF',
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Clinical Psychology' },
    );
    expect(dossier.assessments).toHaveLength(2);
  });

  it('4. APA program match from fixture HTML/URL', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          graduationYear: 2008,
          statement: 'Ph.D. Clinical Psychology USF',
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Neuropsychology' },
    ).assessments[0];
    expect(a.apaStatus).not.toBe('no_matching_program');
    expect(a.apaEvidence?.url).toBe(APA_CLINICAL.url);
  });

  it('5. no matching program', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. Clinical Psychology USF',
        }),
      ],
      [APA_OTHER_SCHOOL],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('no_matching_program');
  });

  it('6. current accreditation, no historical dates on CV', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. Clinical Psychology, University of South Florida',
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('currently_accredited');
    expect(a.limitations.join(' ')).toMatch(/years were not stated|historical/i);
  });

  it('7. historical accredited during period', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'Example University',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          startYear: 2001,
          endYear: 2005,
          graduationYear: 2005,
          statement: 'Ph.D. Example University 2005',
        }),
      ],
      [APA_HISTORICAL],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('accredited_during_period');
  });

  it('8. historical not accredited during period (affirmative fixture)', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'Late Start University',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          startYear: 2005,
          endYear: 2010,
          graduationYear: 2010,
          statement: 'Ph.D. Late Start University 2010',
        }),
      ],
      [APA_NOT_DURING],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('not_accredited_during_period');
  });

  it('10. missing attendance dates → currently accredited with limitation', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. Clinical Psychology USF',
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('currently_accredited');
    expect(a.limitations.length).toBeGreaterThan(0);
  });

  it('11. missing program name → insufficient or cautious match', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          degreeName: 'Ph.D.',
          degreeKind: 'doctoral',
          program: null,
          fieldOfStudy: null,
          statement: 'Ph.D., University of South Florida, 2008',
          graduationYear: 2008,
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Cardiology' },
    ).assessments[0];
    expect([
      'insufficient_education_details',
      'not_applicable',
      'unable_to_verify',
      'currently_accredited',
      'accredited_during_period',
    ]).toContain(a.apaStatus);
  });

  it('12. unrelated degree → not_applicable', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of Florida',
          degreeName: 'B.S.',
          degreeKind: 'bachelors',
          fieldOfStudy: 'Biology',
          graduationYear: 1999,
          statement: 'B.S., Biology, University of Florida',
        }),
      ],
      [CHEA_USF],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaStatus).toBe('not_applicable');
    expect(a.institutionalStatus).toBeTruthy();
  });

  it('13. APA source unavailable / restricted', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. USF',
        }),
      ],
      [],
      { specialty: 'Clinical Psychology', sourceUnavailable: true },
    ).assessments[0];
    expect(a.apaStatus).toBe('unable_to_verify');
    expect(a.limitations.join(' ')).toMatch(/unavailable|restricted/i);
  });

  it('14. search API failure → unable_to_verify', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. USF',
        }),
      ],
      [],
      { specialty: 'Clinical Psychology', searchFailed: true },
    ).assessments[0];
    expect(a.apaStatus).toBe('unable_to_verify');
    expect(a.apaStatus).not.toBe('not_accredited_during_period');
  });

  it('15. misleading similar university name rejected', () => {
    const a = assessProgramAccreditationFromMaterials(
      [
        entry({
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          statement: 'Ph.D. USF',
        }),
      ],
      [APA_OTHER_SCHOOL],
      { specialty: 'Clinical Psychology' },
    ).assessments[0];
    expect(a.apaEvidence).toBeNull();
    expect(a.apaStatus).toBe('no_matching_program');
  });

  it('16. duplicate institution/program deduped', () => {
    const dossier = assessProgramAccreditationFromMaterials(
      [
        entry({
          id: 'e1',
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          graduationYear: 2008,
          statement: 'Ph.D. USF 2008',
        }),
        entry({
          id: 'e2',
          institution: 'University of South Florida',
          program: 'Clinical Psychology',
          degreeName: 'Ph.D.',
          graduationYear: 2008,
          statement: 'Ph.D. USF 2008 (repeat)',
        }),
      ],
      [APA_CLINICAL],
      { specialty: 'Clinical Psychology' },
    );
    expect(dossier.assessments).toHaveLength(1);
  });

  it('17. report lists every degree independently', () => {
    const dossier = assessProgramAccreditationFromMaterials(
      [
        entry({
          id: 'e1',
          institution: 'University of Florida',
          degreeName: 'B.A.',
          degreeKind: 'bachelors',
          graduationYear: 2000,
          statement: 'B.A., Psychology, University of Florida, 2000',
        }),
        entry({
          id: 'e2',
          institution: 'University of South Florida',
          degreeName: 'Ph.D.',
          program: 'Clinical Psychology',
          graduationYear: 2008,
          statement: 'Ph.D., Clinical Psychology, USF, 2008',
        }),
      ],
      [APA_CLINICAL, CHEA_USF],
      { specialty: 'Clinical Psychology' },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Psychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      accreditation: dossier,
    });
    const section = document.sections.find(
      (s) => s.id === 'university-accreditation',
    );
    expect(section).toBeTruthy();
    const text = section!.blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/University of Florida/);
    expect(text).toMatch(/University of South Florida/);
    expect(text).toMatch(/APA CoA result:/);
    expect(text).toMatch(/Not Applicable|B\.A\./);
  });
});
