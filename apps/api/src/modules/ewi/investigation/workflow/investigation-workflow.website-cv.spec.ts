import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import {
  extractionFromWebsiteCv,
  publicCvCandidateUrls,
  publicCvFoundUnparsed,
  recordLooksLikeCvDocument,
} from './investigation-workflow';

function record(
  over: Partial<WebRecord> & Pick<WebRecord, 'id' | 'url' | 'title'>,
): WebRecord {
  return {
    kind: 'expert_website',
    snippet: null,
    summary: over.summary ?? `${over.title} curriculum vitae`,
    publishedAt: null,
    retrievedAt: '2026-10-28T00:00:00.000Z',
    searchProviders: [],
    queries: [],
    read: 'read',
    readNote: null,
    match: {
      level: 'strong',
      confidence: 'high',
      basis: [],
      conflicts: [],
      quote: over.title,
      quoteVerified: true,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims: over.claims ?? [
      {
        type: 'credential',
        text: 'Ph.D. in psychology',
        quote: 'Ph.D. in psychology',
        topic: 'education',
        basis: 'subject_stated',
        from: 'page',
      },
    ],
    ...over,
  };
}

function dossier(records: WebRecord[]): WebResearchDossier {
  return {
    ranAt: '2026-10-28T00:00:00.000Z',
    durationMs: 1,
    partial: false,
    partialNote: null,
    queriesPlanned: 1,
    queriesRun: 1,
    providers: [],
    pagesRead: records.length,
    pagesBlocked: [],
    candidates: [],
    records,
    registries: [],
    limitations: [],
  };
}

describe('extractionFromWebsiteCv', () => {
  it('prefers the expert’s own-host CV and rejects a colleague CV', () => {
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'jesse',
          url: 'https://static1.squarespace.com/static/x/Jesse+Fischer+CV+2024.pdf',
          title: 'Jesse Fischer CV 2024',
          kind: 'other',
          summary:
            'Jesse Fischer, Ph.D. Clinical Neuropsychologist. 8/2021 – Current Clinical Neuropsychologist Leah Ellenberg, PhD and Associates Beverly Hills, CA',
        }),
        record({
          id: 'leah',
          url: 'https://leahellenberg.com/ellenbergCV.pdf',
          title: 'January, 2022 CURRICULUM VITAE Leah Ellenberg, Ph.D.',
          summary:
            'January, 2022 CURRICULUM VITAE Leah Ellenberg, Ph.D. PERSONAL INFORMATION Name Leah Ellenberg, Ph.D.',
        }),
      ]),
      'Leah Ellenberg',
    );
    expect(extraction?.document.id).toContain('ellenbergCV.pdf');
    expect(extraction?.document.name).toMatch(/Ellenberg/i);
  });

  it('returns null when only a colleague CV was found', () => {
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'jesse',
          url: 'https://static1.squarespace.com/static/x/Jesse+Fischer+CV+2024.pdf',
          title: 'Jesse Fischer CV 2024',
          kind: 'other',
          summary:
            'Jesse Fischer, Ph.D. works with Leah Ellenberg, PhD and Associates.',
        }),
      ]),
      'Leah Ellenberg',
    );
    expect(extraction).toBeNull();
  });

  it('runs website CV claims through finalizeCvClaims junk filters', () => {
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'leah',
          url: 'https://leahellenberg.com/ellenbergCV.pdf',
          title: 'Curriculum Vitae Leah Ellenberg, Ph.D.',
          summary: 'Ph.D., UCLA, 1978. Clinical neuropsychology.',
          claims: [
            {
              type: 'credential',
              text: 'January, 2022 CURRICULUM VITAE Leah Ellenberg PERSONAL INFORMATION Business Address 9401 Wilshire',
              quote:
                'January, 2022 CURRICULUM VITAE Leah Ellenberg PERSONAL INFORMATION Business Address 9401 Wilshire',
              topic: 'education',
              basis: 'subject_stated',
              from: 'page',
            },
            {
              type: 'credential',
              text: 'Ph.D. in Clinical Psychology, UCLA, 1978',
              quote: 'Ph.D. in Clinical Psychology, UCLA, 1978',
              topic: 'education',
              basis: 'subject_stated',
              from: 'page',
            },
            {
              type: 'credential',
              text: 'In addition, Dr. Glass was honored to be awarded several NIH grants',
              quote:
                'In addition, Dr. Glass was honored to be awarded several NIH grants',
              topic: 'award',
              basis: 'subject_stated',
              from: 'page',
            },
          ],
        }),
      ]),
      'Leah Ellenberg',
    );
    expect(extraction).not.toBeNull();
    expect(
      extraction!.claims.every(
        (c) => !/curriculum vitae|personal information/i.test(c.statement),
      ),
    ).toBe(true);
    expect(
      extraction!.claims.some((c) => /Ph\.D\./i.test(c.statement)),
    ).toBe(true);
    expect(
      extraction!.claims.some((c) => /Dr\. Glass/i.test(c.statement)),
    ).toBe(false);
  });

  it('recognizes a Google Drive CV with CV content and extracts degrees', () => {
    const driveUrl =
      'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/view';
    const summary = [
      'CURRICULUM VITAE Jane Expert, Ph.D.',
      'EDUCATION',
      'Ph.D. Clinical Psychology, University of Example, 2008',
      'B.A. Psychology, State College, 2002',
      'Clinical Internship, Regional Medical Center',
      'LICENSURE Licensed Psychologist, Florida',
      'MEMBERSHIPS Member of the American Psychological Association',
      'PUBLICATIONS',
      '1. Expert J. Cognitive outcomes after injury. J Neuropsychol. 2015.',
    ].join('\n');
    expect(
      recordLooksLikeCvDocument({
        url: driveUrl,
        title: 'Jane Expert CV',
        summary,
      }),
    ).toBe(true);
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'drive-cv',
          url: driveUrl,
          title: 'Jane Expert CV',
          summary,
          claims: [
            {
              type: 'credential',
              text: 'Ph.D. Clinical Psychology, University of Example, 2008',
              quote: 'Ph.D. Clinical Psychology, University of Example, 2008',
              topic: 'education',
              basis: 'subject_stated',
              from: 'page',
            },
          ],
        }),
      ]),
      'Jane Expert',
    );
    expect(extraction).not.toBeNull();
    expect(extraction!.document.id).toBe(driveUrl);
    expect(
      extraction!.claims.some(
        (c) =>
          c.category === 'education' && /University of Example/i.test(c.statement),
      ),
    ).toBe(true);
    expect(
      extraction!.claims.some((c) => c.category === 'education'),
    ).toBe(true);
    // Missing internship year stays unknown (no invented date required).
    const internship = extraction!.claims.find((c) =>
      /Internship/i.test(c.statement),
    );
    if (internship) {
      expect(internship.details.year).toBeUndefined();
    }
  });

  it('lists unread Drive CV URLs as candidates and read-but-thin as unparsed', () => {
    const driveUrl =
      'https://drive.google.com/file/d/1ThinCvFileIdABCDEFGHIJ/view';
    const unread = dossier([
      record({
        id: 'unread',
        url: driveUrl,
        title: 'Curriculum Vitae Jane Expert',
        summary: 'Curriculum vitae Jane Expert linked from practice site.',
        read: 'restricted',
        claims: [],
      }),
    ]);
    expect(publicCvCandidateUrls(unread, 'Jane Expert')).toContain(driveUrl);

    const thin = dossier([
      record({
        id: 'thin',
        url: driveUrl,
        title: 'Curriculum Vitae Jane Expert',
        summary:
          'Curriculum vitae Jane Expert. This page has enough text to count as retrieved but no structured education or license statements that extract cleanly for comparison after junk filters remove headers.',
        claims: [],
      }),
    ]);
    // Found for discovery; extraction may still be null after finalize.
    expect(publicCvFoundUnparsed(thin, 'Jane Expert').length).toBeGreaterThan(0);
  });

  it('dedupes duplicate CV links when ranking website CVs', () => {
    const url = 'https://janeexpert.com/Jane-Expert-CV.pdf';
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'a',
          url,
          title: 'Curriculum Vitae Jane Expert',
          summary:
            'CURRICULUM VITAE Jane Expert Ph.D. Education Ph.D. University of Example 2008',
        }),
        record({
          id: 'b',
          url,
          title: 'Curriculum Vitae Jane Expert',
          summary:
            'CURRICULUM VITAE Jane Expert Ph.D. Education Ph.D. University of Example 2008',
        }),
      ]),
      'Jane Expert',
    );
    expect(extraction?.document.id).toBe(url);
  });

  it('accepts a generic PDF filename when content is clearly a CV', () => {
    const extraction = extractionFromWebsiteCv(
      dossier([
        record({
          id: 'generic',
          url: 'https://janeexpert.com/uploads/document.pdf',
          title: 'Professional documents',
          summary: [
            'CURRICULUM VITAE',
            'Jane Expert, Ph.D.',
            'EDUCATION Ph.D. Clinical Psychology University of Example 2008',
            'LICENSURE Licensed Psychologist Florida',
            'PUBLICATIONS 1. Expert J. Title here. Journal. 2019.',
            'MEMBERSHIPS Member of APA',
            'PROFESSIONAL EXPERIENCE Clinical Director Example Clinic',
          ].join('\n'),
        }),
      ]),
      'Jane Expert',
    );
    expect(extraction).not.toBeNull();
    expect(extraction!.claims.length).toBeGreaterThan(0);
  });
});
