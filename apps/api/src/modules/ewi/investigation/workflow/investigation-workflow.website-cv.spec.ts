import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import { extractionFromWebsiteCv } from './investigation-workflow';

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
});
