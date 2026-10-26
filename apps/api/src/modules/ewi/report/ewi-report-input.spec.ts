import type { EwiInvestigationResult } from '../investigation/jobs/ewi-investigation-job.types';
import { prepareEwiReportInput, questionsAreStale } from './ewi-report-input';
import { buildEwiReportDocument } from './ewi-report.template';

function result(
  overrides: Partial<EwiInvestigationResult> = {},
): EwiInvestigationResult {
  return {
    expertName: 'Jane Doe',
    city: 'Boston',
    specialty: 'Neurology',
    evidence: [],
    discrepancies: [],
    questions: [],
    questionCount: 0,
    sourceStatuses: [],
    reportFileName: 'ewi-jane-doe-report.pdf',
    generatedAt: '2026-10-19T12:00:00.000Z',
    disclaimer: '',
    summary: '',
    analysis: undefined as never,
    legalResearch: undefined as never,
    onlinePresence: undefined as never,
    professionalBackground: undefined as never,
    ...overrides,
  };
}

describe('prepareEwiReportInput', () => {
  it('does not treat stored OpenAlex title misses as current discrepancies', () => {
    const input = prepareEwiReportInput(
      result({
        discrepancies: [
          {
            id: 'cv-check-cvc-1',
            severity: 'medium',
            title:
              'Publication not found in the catalogs checked: Axial movements',
            description: 'OpenAlex listed no work with this title.',
            evidenceIds: [],
            relatedUrls: [],
            label: 'not_found',
            field: 'publication',
            previousValue: 'Axial movements are relatively preserved.',
            currentValue: null,
            change: null,
            cvDate: null,
            cvSource: 'Uploaded CV: cv.pdf',
            supportingSource: 'OpenAlex',
            priority: 3,
            sources: [],
          },
        ],
      }),
    );
    expect(input.discrepancies).toEqual([]);
  });

  it('rebuilds stale stored questions instead of reprinting them', () => {
    const stale = [
      {
        number: 1,
        category: 'Background and credentials',
        question: 'Is every license in finding f1 current?',
        evidenceBasis: 'collected record',
        label: 'unresolved' as const,
        sources: [],
      },
      {
        number: 2,
        category: 'Background and credentials',
        question: 'How should counsel weigh the collected record?',
        evidenceBasis: 'investigation file',
        label: 'unresolved' as const,
        sources: [],
      },
    ];
    expect(questionsAreStale(stale)).toBe(true);
    const input = prepareEwiReportInput(
      result({
        questions: stale,
        questionCount: 2,
        evidence: [
          {
            sourceId: 'npi_registry',
            category: 'license',
            title: 'CA License',
            summary:
              'California psychologist license PSY12345 is active and was issued in 2009.',
            url: 'https://example.test/license',
            informationStatus: 'verified',
            identityMatch: 'matched',
            source: {
              providerId: 'state_license',
              name: 'California DCA',
              retrievedAt: '2026-10-01T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
      }),
    );
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0].question).toContain('PSY12345');
    expect(JSON.stringify(input.questions)).not.toMatch(/finding f1/i);
    expect(input.questionsNote).toMatch(/not reprinted/i);

    const document = buildEwiReportDocument(input);
    expect(
      document.sections.find((section) => section.id === 'questions'),
    ).toBeUndefined();
    expect(document.highlights).toContain(
      'Cross-examination questions omitted',
    );
  });

  it('infers honest coverage for older source statuses that omitted it', () => {
    const input = prepareEwiReportInput(
      result({
        sourceStatuses: [
          {
            sourceId: 'patents',
            status: 'unavailable',
            attemptStatus: 'unavailable',
            disposition: 'unavailable',
            message:
              'Not searched. Patents live adapter is not connected. No record was retrieved.',
            itemCount: 0,
            checked: true,
          },
          {
            sourceId: 'pubmed',
            status: 'no_result',
            attemptStatus: 'completed',
            disposition: 'completed',
            message: 'PubMed returned no record.',
            itemCount: 0,
            checked: true,
          },
        ],
      }),
    );
    expect(input.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'patents',
          coverage: 'not_implemented',
          checked: false,
        }),
        expect.objectContaining({
          sourceId: 'pubmed',
          coverage: 'searched_no_results',
          checked: true,
        }),
      ]),
    );
  });

  it('does not mutate historical questions, discrepancies, or source statuses', () => {
    const stored = result({
      discrepancies: [
        {
          id: 'cv-check-cvc-1',
          severity: 'medium',
          title:
            'Publication not found in the catalogs checked: Axial movements',
          description: 'OpenAlex listed no work with this title.',
          evidenceIds: [],
          relatedUrls: [],
          label: 'not_found',
          field: 'publication',
          previousValue: 'Axial movements are relatively preserved.',
          currentValue: null,
          change: null,
          cvDate: null,
          cvSource: 'Uploaded CV: cv.pdf',
          supportingSource: 'OpenAlex',
          priority: 3,
          sources: [],
        },
      ],
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question: 'Is every license in finding f1 current?',
          evidenceBasis: 'collected record',
          label: 'unresolved',
          sources: [],
        },
      ],
      sourceStatuses: [
        {
          sourceId: 'patents',
          status: 'unavailable',
          attemptStatus: 'unavailable',
          disposition: 'unavailable',
          outcome: 'restricted',
          message: 'Not searched. Patents live adapter is not connected.',
          itemCount: 0,
          checked: true,
        },
      ],
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(input.discrepancies).toEqual([]);
    expect(input.sourceStatuses?.[0]).toMatchObject({
      coverage: 'not_implemented',
      checked: false,
    });
    expect(stored.sourceStatuses[0]?.checked).toBe(true);
    expect(stored.questions[0]?.question).toMatch(/finding f1/);
  });

  it('keeps grounded stored questions and drops ungrounded legacy ones without writing back', () => {
    const grounded = {
      number: 4,
      category: 'Background and credentials',
      question:
        'California DCA lists license PSY12345 as active. That is your current license record, correct?',
      evidenceBasis:
        'Verified. California DCA: “PSY12345” https://example.test/license',
      label: 'verified' as const,
      sources: [
        { name: 'California DCA', url: 'https://example.test/license' },
      ],
      evidenceIds: ['https://example.test/license'],
      basisKind: 'sourced_fact' as const,
    };
    const stored = result({
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question: 'Is every license in finding f1 current?',
          evidenceBasis: 'collected record',
          label: 'unresolved',
          sources: [],
        },
        grounded,
      ],
      questionCount: 2,
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0]).toMatchObject({
      number: 1,
      question: grounded.question,
    });
    expect(JSON.stringify(input.questions)).not.toMatch(/finding f1/i);
    expect(input.questionsNote).toMatch(/omitted/i);

    const document = buildEwiReportDocument(input);
    expect(
      document.sections.find((section) => section.id === 'questions'),
    ).toBeUndefined();
    expect(document.highlights?.[2]).toBe(
      'Cross-examination questions omitted',
    );
  });

  it('generates grounded questions when an older result stored none', () => {
    const input = prepareEwiReportInput(
      result({
        questions: [],
        questionCount: 0,
        evidence: [
          {
            sourceId: 'state_license',
            category: 'license',
            title: 'CA License',
            summary:
              'California psychologist license PSY12345 is active and was issued in 2009.',
            url: 'https://example.test/license',
            informationStatus: 'verified',
            identityMatch: 'matched',
            source: {
              providerId: 'state_license',
              name: 'California DCA',
              retrievedAt: '2026-10-01T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
      }),
    );
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0].question).toContain('PSY12345');
    expect(input.questions[0].evidenceIds).toEqual([
      'https://example.test/license',
    ]);
  });

  it('re-normalizes stored legal captions from docket URL slugs without writing back', () => {
    const robertsUrl =
      'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/';
    const kandy431 =
      'https://www.courtlistener.com/docket/66837428/431/head-kandy-llc-v-mcneill/';
    const kandy432 =
      'https://www.courtlistener.com/docket/66837428/432/head-kandy-llc-v-mcneill/';
    const stored = result({
      legalResearch: {
        matters: [],
        orders: [],
        motionsAndPleadings: [],
        depositions: [],
        testimonyContradictions: [],
        challenges: [],
        sourceAttempts: [
          { sourceId: 'courtlistener', status: 'ok', itemCount: 3 },
        ],
      },
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'court_order',
          title:
            'ORDER granting 24 Motion to Compel — Caption not listed on this search result',
          summary: 'Search snippet only.',
          url: robertsUrl,
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            caseName: 'Caption not listed on this search result',
            documentType: 'order',
          },
        },
        {
          sourceId: 'courtlistener',
          category: 'motion',
          title: 'Daubert motion — Caption not listed on this search result',
          summary: 'Search snippet of a Daubert motion.',
          url: kandy431,
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: { documentNumber: '431', documentType: 'motion' },
        },
        {
          sourceId: 'courtlistener',
          category: 'motion',
          title: 'Reply — Caption not listed on this search result',
          summary: 'Search snippet of a reply.',
          url: kandy432,
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: { documentNumber: '432', documentType: 'motion' },
        },
      ],
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(input.legalResearch?.sourceAttempts).toEqual([
      { sourceId: 'courtlistener', status: 'ok', itemCount: 3 },
    ]);
    const document = buildEwiReportDocument(input);
    const orders = sectionText(document, 'orders');
    const pleadings = sectionText(document, 'pleadings');
    expect(orders).toMatch(/Roberts v\. USAA General Indemnity Company/);
    expect(orders).not.toMatch(/Caption not listed/i);
    expect(orders).toMatch(/full document was not read/i);
    expect(pleadings).toMatch(/Head Kandy LLC v\. Mcneill/);
    expect(pleadings).toContain('/431/');
    expect(pleadings).toContain('/432/');
  });

  it('filters stored identifier, boilerplate, and contact-dump questions and keeps grounded ones', () => {
    const stored = result({
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question:
            'According to NPI Registry (NPPES) records, does it state: “The NPI Registry lists Jason Andrew Demery, PhD as an individual clinician with NPI 1700077724. Primary taxonomy: Clinical Neuropsychologist.”?',
          evidenceBasis:
            'Verified. NPI Registry (NPPES): “NPI 1700077724” https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          label: 'verified',
          sources: [
            {
              name: 'NPI Registry (NPPES)',
              url: 'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
            },
          ],
          evidenceIds: [
            'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          ],
          excerpt: 'NPI 1700077724',
        },
        {
          number: 6,
          category: 'Background and credentials',
          question:
            'Does abpp.org state: "Board certification is an annual certification that is due January 1." Is that accurate?',
          evidenceBasis:
            'Verified. abpp.org: “Board certification is an annual certification that is due January 1.”',
          label: 'verified',
          sources: [
            {
              name: 'abpp.org',
              url: 'https://abpp.org/directory/entry/32415/',
            },
          ],
          evidenceIds: ['https://abpp.org/directory/entry/32415/'],
          excerpt:
            'Board certification is an annual certification that is due January 1.',
        },
        {
          number: 7,
          category: 'Background and credentials',
          question:
            'Does abpp.org state: "This directory lists all current ABPP board certified psychologists." Is that accurate?',
          evidenceBasis:
            'Verified. abpp.org: “This directory lists all current ABPP board certified psychologists.”',
          label: 'verified',
          sources: [
            {
              name: 'abpp.org',
              url: 'https://abpp.org/directory/entry/32415/',
            },
          ],
          evidenceIds: ['https://abpp.org/directory/entry/32415/'],
          excerpt:
            'This directory lists all current ABPP board certified psychologists.',
        },
        {
          number: 20,
          category: 'Background and credentials',
          question:
            'pmc.ncbi.nlm.nih.gov states about you: “Jason Demery, Email: jasondemery@gmail.com, Assistant Professor of Psychiatry, University of Florida Forensic Institute, Licensed Psychologist & Forensic Neuropsychologist, UF Springhill Health Center, 8491 NW 39th Ave.” That is accurate, correct?',
          evidenceBasis:
            'Verified. pmc.ncbi.nlm.nih.gov: “Jason Demery, Email: jasondemery@gmail.com, 8491 NW 39th Ave.”',
          label: 'verified',
          sources: [
            {
              name: 'pmc.ncbi.nlm.nih.gov',
              url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3830977/',
            },
          ],
          evidenceIds: ['https://pmc.ncbi.nlm.nih.gov/articles/PMC3830977/'],
          excerpt:
            'Jason Demery, Email: jasondemery@gmail.com, Assistant Professor, 8491 NW 39th Ave.',
        },
        {
          number: 36,
          category: 'Prior testimony and legal matters',
          question:
            'This public motion contains Jason A. Demery, a Neuropsychology term, and admissibility-challenge language. You are aware of that, correct?',
          evidenceBasis:
            'Unresolved. CourtListener: “This public motion contains Jason A. Demery”',
          label: 'unresolved',
          sources: [{ name: 'CourtListener' }],
          evidenceIds: ['motion-1'],
          excerpt: 'This public motion contains Jason A. Demery',
        },
        {
          number: 58,
          category: 'Marketing and expert-witness business',
          question:
            'Does neuropsychologicalsciences.com state on 2018-06-13: "Psychological Assessment & Neuropsychological Evaluations Forensic Psychological Assessment MENU"? Is that accurate?',
          evidenceBasis:
            'Verified. neuropsychologicalsciences.com: “Psychological Assessment & Neuropsychological Evaluations MENU”',
          label: 'verified',
          sources: [
            {
              name: 'neuropsychologicalsciences.com',
              url: 'https://neuropsychologicalsciences.com/',
            },
          ],
          evidenceIds: ['https://neuropsychologicalsciences.com/'],
          excerpt:
            'Psychological Assessment & Neuropsychological Evaluations Forensic Psychological Assessment MENU',
        },
        {
          number: 59,
          category: 'Marketing and expert-witness business',
          question:
            'Did neuropsychologicalsciences.com state on 2018-06-13: “Psychological Assessment & Neuropsychological Evaluations Forensic Psychological Assessment MENU”?',
          evidenceBasis:
            'Verified. neuropsychologicalsciences.com: “Psychological Assessment & Neuropsychological Evaluations MENU”',
          label: 'verified',
          sources: [
            {
              name: 'neuropsychologicalsciences.com',
              url: 'https://neuropsychologicalsciences.com/',
            },
          ],
          evidenceIds: ['https://neuropsychologicalsciences.com/'],
          excerpt:
            'Psychological Assessment & Neuropsychological Evaluations Forensic Psychological Assessment MENU',
        },
        {
          number: 2,
          category: 'Background and credentials',
          question:
            'NPI Registry (NPPES) lists license PY7500 as self-reported. That registry does not verify licenses with the state board. Can you produce the official board record for PY7500?',
          evidenceBasis:
            'Unresolved. NPI Registry (NPPES): “PY7500” https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          label: 'unresolved',
          sources: [
            {
              name: 'NPI Registry (NPPES)',
              url: 'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
            },
          ],
          evidenceIds: [
            'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          ],
          excerpt: 'PY7500',
        },
        {
          number: 8,
          category: 'Publications and authorship',
          question:
            'PubMed lists you as an author on “Elevated Levels of Serum GFAP” (PMID 21069617). Is that authorship accurate?',
          evidenceBasis:
            'Verified. PubMed: “Elevated Levels of Serum GFAP” PMID 21069617',
          label: 'verified',
          sources: [
            {
              name: 'PubMed',
              url: 'https://pubmed.ncbi.nlm.nih.gov/21069617/',
            },
          ],
          evidenceIds: ['https://pubmed.ncbi.nlm.nih.gov/21069617/'],
          excerpt: 'Elevated Levels of Serum GFAP',
        },
      ],
    });
    const before = JSON.stringify(stored);
    const input = prepareEwiReportInput(stored);
    expect(JSON.stringify(stored)).toBe(before);
    const text = input.questions
      .map((question) => question.question)
      .join('\n');
    expect(text).not.toMatch(/NPI 1700077724/);
    expect(text).not.toMatch(/This directory lists all current/i);
    expect(text).not.toMatch(/Board certification is an annual certification/i);
    expect(text).not.toMatch(/jasondemery@gmail\.com/i);
    expect(text).not.toMatch(/This public motion contains/i);
    expect(text).toMatch(/PY7500/);
    expect(text).toMatch(/official board record/);
    expect(text).toMatch(/PMID 21069617/);
    const practice = input.questions.filter((question) =>
      question.sources?.some((source) =>
        source.url?.includes('neuropsychologicalsciences.com'),
      ),
    );
    expect(practice.length).toBeLessThanOrEqual(2);
    expect(input.questionsNote).toMatch(/omitted/i);
    expect(stored.questions).toHaveLength(9);
  });

  it('does not print a truncated docket slug as a completed caption', () => {
    const stored = result({
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'court_order',
          title: 'STIPULATION Regarding Competency',
          summary: 'Search snippet only.',
          url: 'https://www.courtlistener.com/docket/6664619/49/1/united-states-v-butl',
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            caseName: 'United States v. Butl',
            documentType: 'order',
          },
        },
      ],
    });
    const before = JSON.stringify(stored);
    const document = buildEwiReportDocument(prepareEwiReportInput(stored));
    expect(JSON.stringify(stored)).toBe(before);
    const orders = sectionText(document, 'orders');
    expect(orders).not.toMatch(/United States v\. Butl/i);
    expect(orders).toMatch(/full document was not read/i);
    expect(orders).toContain('united-states-v-butl');
  });

  it('keeps valid stored questions and adds caption-aware legal questions from evidence', () => {
    const robertsUrl =
      'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/';
    const stored = result({
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question:
            'NPI Registry (NPPES) lists license PY7500 as self-reported. That registry does not verify licenses with the state board. Can you produce the official board record for PY7500?',
          evidenceBasis:
            'Unresolved. NPI Registry (NPPES): “PY7500” https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          label: 'unresolved',
          sources: [
            {
              name: 'NPI Registry (NPPES)',
              url: 'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
            },
          ],
          evidenceIds: [
            'https://npiregistry.cms.hhs.gov/provider-view/1700077724',
          ],
          excerpt: 'PY7500',
        },
        {
          number: 2,
          category: 'Prior testimony and legal matters',
          question:
            'This public motion contains Jason A. Demery, a Neuropsychology term, and admissibility-challenge language. You are aware of that, correct?',
          evidenceBasis:
            'Unresolved. CourtListener: “This public motion contains Jason A. Demery”',
          label: 'unresolved',
          sources: [{ name: 'CourtListener' }],
          evidenceIds: ['motion-1'],
          excerpt: 'This public motion contains Jason A. Demery',
        },
        {
          number: 3,
          category: 'Publications and authorship',
          question:
            'PubMed lists you as an author on “Elevated Levels of Serum GFAP” (PMID 21069617). Is that authorship accurate?',
          evidenceBasis:
            'Verified. PubMed: “Elevated Levels of Serum GFAP” PMID 21069617',
          label: 'verified',
          sources: [
            {
              name: 'PubMed',
              url: 'https://pubmed.ncbi.nlm.nih.gov/21069617/',
            },
          ],
          evidenceIds: ['https://pubmed.ncbi.nlm.nih.gov/21069617/'],
          excerpt: 'Elevated Levels of Serum GFAP',
        },
      ],
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'motion',
          title: 'Daubert motion — Caption not listed on this search result',
          summary: 'Search snippet of a Daubert motion.',
          url: robertsUrl,
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            caseName: 'Caption not listed on this search result',
            documentType: 'motion',
            challenge: { standard: 'daubert' },
          },
          source: {
            providerId: 'courtlistener',
            name: 'Legal cases (CourtListener)',
            retrievedAt: '2026-10-22T00:00:00.000Z',
            access: 'public',
          },
        },
      ],
    });
    const input = prepareEwiReportInput(stored);
    const text = input.questions
      .map((question) => question.question)
      .join('\n');
    expect(text).toMatch(/PY7500/);
    expect(text).toMatch(/PMID 21069617/);
    expect(text).toMatch(/Roberts v\. USAA General Indemnity Company/);
    expect(text).not.toMatch(/This public motion contains/i);
    expect(
      input.questions.filter((question) =>
        question.question.includes('Roberts v. USAA General Indemnity Company'),
      ),
    ).toHaveLength(1);
    expect(input.questions.map((question) => question.number)).toEqual(
      input.questions.map((_, index) => index + 1),
    );
    expect(input.questionsNote).toMatch(/omitted/i);
    expect(input.questionsNote).toMatch(/Legal questions were generated/i);
    const document = buildEwiReportDocument(input);
    expect(
      document.sections.find((section) => section.id === 'questions'),
    ).toBeUndefined();
  });

  it('does not duplicate a stored legal question that already uses the resolved caption', () => {
    const storedQuestion =
      'Legal cases (CourtListener) has “Roberts v. USAA General Indemnity Company”, case 8:24-cv-1 (motion) with admissibility-challenge language naming you. Were you the expert whose testimony was at issue in that filing?';
    const input = prepareEwiReportInput(
      result({
        questions: [
          {
            number: 1,
            category: 'Prior testimony and legal matters',
            question: storedQuestion,
            evidenceBasis:
              'A public filing or opinion names the expert. https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
            label: 'unresolved',
            sources: [
              {
                name: 'Legal cases (CourtListener)',
                url: 'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
              },
            ],
            evidenceIds: [
              'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
            ],
            excerpt: 'Roberts v. USAA General Indemnity Company',
          },
        ],
        evidence: [
          {
            sourceId: 'courtlistener',
            category: 'motion',
            title: 'Daubert motion',
            summary: 'Search snippet of a Daubert motion.',
            url: 'https://www.courtlistener.com/docket/67985665/26/roberts-v-usaa-general-indemnity-company/',
            informationStatus: 'unverified',
            identityMatch: 'matched',
            raw: {
              caseName: 'Roberts v. USAA General Indemnity Company',
              caseNumber: '8:24-cv-1',
              documentType: 'motion',
              challenge: { standard: 'daubert' },
            },
            source: {
              providerId: 'courtlistener',
              name: 'Legal cases (CourtListener)',
              retrievedAt: '2026-10-22T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
      }),
    );
    const roberts = input.questions.filter((question) =>
      question.question.includes('Roberts v. USAA General Indemnity Company'),
    );
    expect(roberts).toHaveLength(1);
  });

  it('prints a safe empty question section when every stored question is rejected and no replacement is grounded', () => {
    const stored = result({
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question:
            'According to NPI Registry (NPPES) records, does it state: “The NPI Registry lists Jason Andrew Demery, PhD as an individual clinician with NPI 1700077724.”?',
          evidenceBasis: 'Verified. NPI 1700077724',
          label: 'verified',
          sources: [{ name: 'NPI Registry (NPPES)' }],
          evidenceIds: ['npi-1'],
          excerpt: 'NPI 1700077724',
        },
      ],
    });
    const input = prepareEwiReportInput(stored);
    expect(input.questions).toEqual([]);
    const document = buildEwiReportDocument(input);
    expect(
      document.sections.find((section) => section.id === 'questions'),
    ).toBeUndefined();
  });

  it('prints pending, empty-search, never-sent, and blocked coverage in the report', () => {
    const stored = result({
      sourceStatuses: [
        {
          sourceId: 'youtube',
          status: 'ok',
          attemptStatus: 'queued',
          disposition: 'unavailable',
          outcome: 'success',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'pubmed',
          status: 'no_result',
          attemptStatus: 'completed',
          disposition: 'completed',
          outcome: 'no_result',
          message: 'PubMed returned no record.',
          itemCount: 0,
          checked: true,
        },
        {
          sourceId: 'lexisnexis',
          status: 'unavailable',
          attemptStatus: 'unavailable',
          disposition: 'paid_access',
          outcome: 'restricted',
          message:
            'Not searched. LexisNexis is restricted. No request was sent. LexisNexis PDFs are not stored.',
          itemCount: 0,
          checked: false,
        },
        {
          sourceId: 'justia',
          status: 'error',
          attemptStatus: 'failed',
          disposition: 'unavailable',
          outcome: 'restricted',
          message: 'Justia presented a bot-protection or access wall.',
          itemCount: 0,
          checked: true,
        },
      ],
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Published opinion',
          summary: 'A published opinion names the expert.',
          url: 'https://www.courtlistener.com/opinion/1/roberts-v-usaa-general-indemnity-company/',
          informationStatus: 'unverified',
          identityMatch: 'matched',
          raw: {
            caseName: 'Roberts v. USAA General Indemnity Company',
            documentType: 'case',
          },
        },
      ],
    });
    const input = prepareEwiReportInput(stored);
    const statuses = input.sourceStatuses ?? [];
    expect(statuses.find((row) => row.sourceId === 'youtube')).toMatchObject({
      coverage: 'pending',
      checked: false,
    });
    expect(statuses.find((row) => row.sourceId === 'pubmed')).toMatchObject({
      coverage: 'searched_no_results',
      checked: true,
    });
    expect(statuses.find((row) => row.sourceId === 'lexisnexis')).toMatchObject(
      {
        coverage: 'not_implemented',
        checked: false,
      },
    );
    expect(statuses.find((row) => row.sourceId === 'justia')).toMatchObject({
      coverage: 'blocked_or_access_denied',
      checked: true,
    });
    const document = buildEwiReportDocument(input);
    const videos = sectionText(document, 'videos');
    expect(videos).toMatch(/has not been searched yet/i);
    expect(videos).not.toMatch(/returned no matching record/i);
    const publications = sectionText(document, 'publications');
    expect(publications).toMatch(/returned no matching record/i);
    expect(publications).toMatch(/not proof that none exist/i);
    const lawsuits = sectionText(document, 'lawsuits');
    expect(lawsuits).toMatch(/LexisNexis is not implemented/i);
    expect(lawsuits).not.toMatch(/LexisNexis could not be accessed/i);
    expect(lawsuits).toMatch(/Justia could not be accessed/i);
    expect(lawsuits).not.toMatch(/Justia has not been searched yet/i);
    expect(lawsuits).toMatch(/Roberts v\. USAA General Indemnity Company/);
  });
});

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
