import type { CvClaim } from '../../cv/cv.types';
import { compareCv } from '../../cv/cv-comparison';
import { buildEwiReportDocument } from '../../report/ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from '../../report/ewi-report.version';
import { uniqueSourceLinks } from '../../report/ewi-source-links';
import { extractStructuredClaimsFromCvText } from '../../cv/cv-claims';
import { routeWebFindings } from '@integrations/web-research';
import { assessInstitutionalAffiliations } from './affiliation-assessment';
import { affiliationEntriesFromClaims } from './affiliation-entries';
import type { AffiliationEntry } from './affiliation.types';

function claim(
  partial: Partial<CvClaim> & Pick<CvClaim, 'category' | 'statement'>,
): CvClaim {
  return {
    id: partial.id ?? 'c1',
    category: partial.category,
    statement: partial.statement,
    details: partial.details ?? {},
    page: partial.page ?? 1,
    quote: partial.quote ?? partial.statement,
  };
}

function entry(
  partial: Partial<AffiliationEntry> & Pick<AffiliationEntry, 'statement'>,
): AffiliationEntry {
  return {
    id: partial.id ?? 'affil-1',
    institution: partial.institution ?? 'University of South Florida',
    department: partial.department ?? null,
    title: partial.title ?? 'Clinical Assistant Professor',
    relationshipType: partial.relationshipType ?? 'clinical_appointment',
    timeframe: partial.timeframe ?? 'current',
    startYear: partial.startYear ?? 2018,
    endYear: partial.endYear ?? null,
    location: null,
    statement: partial.statement,
    quote: partial.quote ?? partial.statement,
    page: partial.page ?? 1,
    cvSourceUrl: partial.cvSourceUrl ?? 'cv://1',
    claimId: partial.claimId ?? 'c1',
    class: partial.class ?? 'appointment',
    extractionConfidence: partial.extractionConfidence ?? 'high',
  };
}

const USF_FACULTY = {
  url: 'https://www.usf.edu/cbcs/psychology/faculty/jane-expert.aspx',
  title: 'Jane Expert — USF Faculty',
  text: `
    Jane Expert, Ph.D.
    Clinical Assistant Professor
    Department of Psychology
    Clinical Neuropsychology
    Tampa, FL
    University of South Florida faculty profile
  `,
};

const HOSPITAL_STAFF = {
  url: 'https://www.tgh.org/find-a-doctor/jane-expert',
  title: 'Jane Expert — Tampa General',
  text: `
    Jane Expert, Ph.D.
    Staff Psychologist
    Tampa General Hospital
    Clinical Neuropsychology
    Tampa, FL
  `,
};

describe('affiliation assessment scenarios', () => {
  it('1. faculty appointment independently verified on institutional directory', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Clinical Assistant Professor, USF' })],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          {
            url: USF_FACULTY.url,
            title: USF_FACULTY.title,
            snippet: 'faculty',
          },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: USF_FACULTY.url,
          title: USF_FACULTY.title,
          text: USF_FACULTY.text,
        }),
    });
    expect(dossier.assessments[0].status).toBe('independently_verified');
    expect(dossier.assessments[0].evidence?.url).toContain('usf.edu');
  });

  it('2. hospital staff appointment verified', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [
        entry({
          institution: 'Tampa General Hospital',
          title: 'Staff Psychologist',
          relationshipType: 'hospital_staff_appointment',
          statement: 'Staff Psychologist, Tampa General Hospital',
        }),
      ],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          {
            url: HOSPITAL_STAFF.url,
            title: HOSPITAL_STAFF.title,
            snippet: 'staff',
          },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: HOSPITAL_STAFF.url,
          title: HOSPITAL_STAFF.title,
          text: HOSPITAL_STAFF.text,
        }),
    });
    expect(dossier.assessments[0].status).toBe('independently_verified');
  });

  it('3. historical appointment verified (not current)', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [
        entry({
          timeframe: 'historical',
          relationshipType: 'historical_appointment',
          startYear: 2008,
          endYear: 2012,
          statement:
            'Assistant Professor, University of South Florida, 2008–2012',
        }),
      ],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          {
            url: USF_FACULTY.url,
            title: USF_FACULTY.title,
            snippet: 'faculty',
          },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: USF_FACULTY.url,
          title: USF_FACULTY.title,
          text: USF_FACULTY.text,
        }),
    });
    expect(dossier.assessments[0].status).toBe(
      'historical_appointment_verified',
    );
  });

  it('4. practicum brochure confirms training, not appointment', async () => {
    const brochure = {
      url: 'https://www.nova.edu/psychology/practicum-sites.pdf',
      title: 'NSU Practicum Training Site Brochure',
      text: 'Clinical practicum training sites for NSU students include Tampa General Hospital.',
    };
    const dossier = await assessInstitutionalAffiliations({
      entries: [
        entry({
          class: 'training',
          relationshipType: 'practicum_placement',
          institution: 'Nova Southeastern University',
          title: 'Practicum',
          statement: 'Clinical Practicum, Nova Southeastern University',
        }),
      ],
      expertName: 'Jane Expert',
      search: () =>
        Promise.resolve([
          { url: brochure.url, title: brochure.title, snippet: brochure.text },
        ]),
      fetchPage: () => Promise.resolve(brochure),
    });
    expect(dossier.assessments[0].status).toBe(
      'training_or_practicum_confirmed',
    );
    expect(dossier.assessments[0].entry.class).toBe('training');
  });

  it('5–6. internship / residency are not appointments', () => {
    const entries = affiliationEntriesFromClaims([
      claim({
        category: 'training',
        statement: 'Internship, VA Medical Center, 2010',
        details: { institution: 'VA Medical Center' },
      }),
      claim({
        category: 'training',
        statement: 'Residency in Neuropsychology, Mayo Clinic, 2011',
        details: { institution: 'Mayo Clinic' },
      }),
    ]);
    expect(entries.every((e) => e.class === 'training')).toBe(true);
    expect(entries.every((e) => e.class !== 'appointment')).toBe(true);
  });

  it('7. degree is not an institutional affiliation', () => {
    expect(
      affiliationEntriesFromClaims([
        claim({
          category: 'education',
          statement: 'Ph.D., University of Florida, 2005',
          details: { degree: 'Ph.D.', institution: 'University of Florida' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('8. membership is not an institutional affiliation', () => {
    expect(
      affiliationEntriesFromClaims([
        claim({
          category: 'membership',
          statement: 'Member, National Academy of Neuropsychology',
        }),
      ]),
    ).toHaveLength(0);
  });

  it('9. publisher is not an employer / affiliation', () => {
    expect(
      affiliationEntriesFromClaims([
        claim({
          category: 'appointment',
          statement: 'Associate Editor, Journal of Clinical Psychology, Wiley',
          details: { title: 'Associate Editor', institution: 'Wiley' },
        }),
      ]),
    ).toHaveLength(0);
  });

  it('10. OpenAlex / publisher host is not appointment verification', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          {
            url: 'https://openalex.org/authors/A123',
            title: 'Jane Expert',
            snippet: 'University of South Florida',
          },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: 'https://openalex.org/authors/A123',
          text: 'Jane Expert, University of South Florida, Clinical Neuropsychology, Tampa',
        }),
    });
    expect(dossier.assessments[0].status).not.toBe('independently_verified');
    expect(dossier.assessments[0].evidence?.url ?? '').not.toMatch(/openalex/i);
  });

  it('11. similar-name listing rejected', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          { url: USF_FACULTY.url, title: 'John Expert', snippet: 'faculty' },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: USF_FACULTY.url,
          title: 'John Expert — USF',
          text: 'John Expert, Ph.D., Professor, Clinical Neuropsychology, Tampa, FL, University of South Florida',
        }),
    });
    expect(dossier.assessments[0].status).toBe('no_matching_record');
  });

  it('12. unable_to_access when directory is login-gated', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
      search: () =>
        Promise.resolve([
          { url: USF_FACULTY.url, title: 'Faculty', snippet: 'directory' },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: USF_FACULTY.url,
          text: 'Please sign in to view the faculty directory.',
          loginRequired: true,
          restricted: true,
        }),
    });
    expect(dossier.assessments[0].status).toBe('unable_to_access');
  });

  it('13. own-site-only → self_reported', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      ownSiteHosts: ['janeexpert.com'],
      search: () =>
        Promise.resolve([
          {
            url: 'https://janeexpert.com/about',
            title: 'About',
            snippet: 'Professor at University of South Florida',
          },
        ]),
      fetchPage: () =>
        Promise.resolve({
          url: 'https://janeexpert.com/about',
          text: 'Jane Expert is Clinical Assistant Professor at University of South Florida, Clinical Neuropsychology, Tampa',
        }),
    });
    expect(dossier.assessments[0].status).toBe('self_reported');
  });

  it('14. no search → self_reported / not overclaimed', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
    });
    expect(dossier.assessments[0].status).toBe('self_reported');
  });

  it('15. practicum brochure routes to Background, not university-rules', () => {
    const brochure = {
      id: 'practicum',
      url: 'https://nova.edu/psychology/practicum-sites.pdf',
      kind: 'university' as const,
      title: 'NSU Clinical Psychology Practicum Training Site Brochure',
      summary:
        'This practicum brochure lists clinical training sites for NSU students. Site supervisor locations included.',
      snippet: 'practicum training site' as string | null,
      publishedAt: null,
      retrievedAt: '2026-11-06T00:00:00.000Z',
      searchProviders: ['test'],
      queries: [],
      read: 'read' as const,
      readNote: null,
      candidateId: null,
      claims: [
        {
          type: 'other' as const,
          text: 'University rules: practicum training site listing',
          quote: 'Clinical training site brochure for practicum placement',
          topic: 'university_rules' as const,
          basis: 'third_party' as const,
          from: 'page' as const,
        },
      ],
      match: {
        level: 'strong' as const,
        confidence: 'high' as const,
        basis: ['name'],
        conflicts: [],
        quote: null,
        quoteVerified: false,
        classifiedBy: 'rules' as const,
      },
    };
    const routed = routeWebFindings(
      {
        ranAt: '2026-11-06T00:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 1,
        queriesRun: 1,
        providers: [],
        pagesRead: 1,
        pagesBlocked: [],
        candidates: [],
        records: [brochure],
        registries: [],
        limitations: [],
        companies: [],
        topics: [],
      },
      { expertName: 'Alex Rivera' },
    );
    expect(routed.get('university-rules')).toBeUndefined();
    expect(
      routed
        .get('background')
        ?.some((f) => /practicum|training/i.test(f.title)),
    ).toBe(true);
  });

  it('16. §6 gets appointments; §9 gets training', () => {
    const appointment = entry({
      id: 'affil-a',
      claimId: 'ca',
      statement: 'Clinical Assistant Professor, USF',
      class: 'appointment',
    });
    const training = entry({
      id: 'affil-t',
      claimId: 'ct',
      class: 'training',
      relationshipType: 'practicum_placement',
      institution: 'Nova Southeastern University',
      title: 'Practicum',
      statement: 'Clinical Practicum, NSU',
    });
    const doc = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T00:00:00.000Z',
      affiliationAssessments: {
        assessedAt: '2026-11-06T00:00:00.000Z',
        assessments: [
          {
            id: 'aa',
            entry: appointment,
            status: 'self_reported',
            institutionCanonical: appointment.institution,
            evidence: null,
            queriesRun: [],
            explanation: 'Self-Reported — Clinical Appointment at USF.',
            limitations: [],
            retrievedAt: '2026-11-06T00:00:00.000Z',
          },
          {
            id: 'at',
            entry: training,
            status: 'training_or_practicum_confirmed',
            institutionCanonical: training.institution,
            evidence: {
              url: 'https://nova.edu/psychology/practicum-sites.pdf',
              title: 'Brochure',
              excerpt: 'practicum',
              retrievedAt: '2026-11-06T00:00:00.000Z',
              host: 'nova.edu',
              identityLevel: 'weak',
              searchResultOnly: false,
              trainingDocument: true,
            },
            queriesRun: [],
            explanation: 'Training or Practicum Confirmed.',
            limitations: [],
            retrievedAt: '2026-11-06T00:00:00.000Z',
          },
        ],
        warnings: [],
      },
    });
    expect(doc.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    const background = doc.sections.find((s) => s.id === 'background');
    const education = doc.sections.find((s) => s.id === 'education');
    const bgText = (background?.blocks ?? []).map((b) => b.text).join('\n');
    const eduText = (education?.blocks ?? []).map((b) => b.text).join('\n');
    expect(bgText).toMatch(/Clinical Assistant Professor|USF|appointment/i);
    expect(eduText).toMatch(/Practicum|training/i);
    expect(eduText).toMatch(/not faculty/i);
  });

  it('17. Source Index / Links include affiliation evidence once with training label', () => {
    const assessments = {
      assessedAt: '2026-11-06T00:00:00.000Z',
      assessments: [
        {
          id: 'at',
          entry: entry({
            class: 'training',
            relationshipType: 'practicum_placement' as const,
            institution: 'Nova Southeastern University',
            statement: 'Practicum',
          }),
          status: 'training_or_practicum_confirmed' as const,
          institutionCanonical: 'Nova Southeastern University',
          evidence: {
            url: 'https://nova.edu/psychology/practicum-sites.pdf',
            title: 'Brochure',
            excerpt: 'practicum',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            host: 'nova.edu',
            identityLevel: 'weak' as const,
            searchResultOnly: false,
            trainingDocument: true,
          },
          queriesRun: [],
          explanation: 'Training confirmed',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        },
      ],
      warnings: [],
    };
    const links = uniqueSourceLinks({ affiliationAssessments: assessments });
    expect(links).toHaveLength(1);
    expect(links[0].category).toMatch(/Training/i);
    expect(links[0].url).toContain('nova.edu');
  });

  it('18. CV comparison no longer uses OpenAlex as appointment checker; TRAINING_LINE extracts training', () => {
    const text = `
      Clinical Practicum, Tampa General Hospital, 2009
      Clinical Assistant Professor, University of South Florida, 2018–present
    `;
    const extracted = extractStructuredClaimsFromCvText(text);
    expect(extracted.some((c) => c.category === 'training')).toBe(true);
    expect(
      extracted.some(
        (c) => c.category === 'appointment' && /Professor/i.test(c.statement),
      ),
    ).toBe(true);

    const appointmentClaim = claim({
      id: 'appt-1',
      category: 'appointment',
      statement: 'Clinical Assistant Professor, University of South Florida',
      details: {
        title: 'Clinical Assistant Professor',
        institution: 'University of South Florida',
      },
    });
    const check = compareCv({
      extraction: {
        document: {
          id: 'doc',
          name: 'cv.pdf',
          pageCount: 1,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [appointmentClaim],
        warnings: [],
      },
      evidence: [
        {
          sourceId: 'openalex',
          category: 'profile',
          title: 'OpenAlex profile',
          summary: 'Author profile',
          url: 'https://openalex.org/A1',
          retrievedAt: '2026-11-06T00:00:00.000Z',
          access: 'public',
          raw: { institutions: ['University of South Florida'] },
        },
      ],
      sourceResults: [],
      identity: null,
      publications: [],
      affiliationAssessments: [
        {
          id: 'aa',
          entry: entry({
            claimId: 'appt-1',
            statement: appointmentClaim.statement,
          }),
          status: 'self_reported',
          institutionCanonical: 'University of South Florida',
          evidence: null,
          queriesRun: [],
          explanation: 'Self-Reported',
          limitations: [],
          retrievedAt: '2026-11-06T00:00:00.000Z',
        },
      ],
    });
    const row = check.comparisons.find((c) => c.topic === 'appointment');
    expect(row?.source?.name).not.toBe('OpenAlex');
    expect(row?.note ?? '').toMatch(/OpenAlex/i);
    expect(row?.label).toBe('not_verified');
  });

  it('snippet-only → potential_match_unconfirmed', async () => {
    const dossier = await assessInstitutionalAffiliations({
      entries: [entry({ statement: 'Professor, University of South Florida' })],
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      search: () =>
        Promise.resolve([
          {
            url: USF_FACULTY.url,
            title: 'Jane Expert — USF Faculty',
            snippet:
              'Jane Expert, Clinical Neuropsychology, Tampa, University of South Florida faculty',
          },
        ]),
      // No fetchPage → search result only
    });
    expect(dossier.assessments[0].status).toBe('potential_match_unconfirmed');
  });
});
