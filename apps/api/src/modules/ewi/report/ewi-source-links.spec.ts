import { PdfParser } from '@modules/document-processing/parsers/pdf.parser';
import { PdfReportRenderer } from '@platform/report/pdf/pdf-report.renderer';
import { EwiPdfReportService } from './ewi-pdf-report.service';
import {
  EWI_SOURCE_LINKS_TEMPLATE_ID,
  buildEwiSourceLinksDocument,
  uniqueSourceLinks,
} from './ewi-source-links';
import { EWI_REPORT_TEMPLATE_VERSION } from './ewi-report.version';

describe('uniqueSourceLinks', () => {
  it('records search-result, metadata, and read-page access from evidence', () => {
    const links = uniqueSourceLinks({
      evidence: [
        {
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Snippet hit',
          url: 'https://www.courtlistener.com/opinion/1/snippet/',
          raw: { retrievalStatus: 'snippet_only' },
        },
        {
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Docket metadata',
          url: 'https://www.courtlistener.com/docket/2/meta/',
          raw: { retrievalStatus: 'metadata_only' },
        },
        {
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Opinion text',
          url: 'https://www.courtlistener.com/opinion/3/full/',
          raw: { retrievalStatus: 'full_text' },
        },
      ],
    });
    expect(
      links.find((link) => link.url.includes('/opinion/1/snippet'))?.access,
    ).toBe('search result only');
    expect(
      links.find((link) => link.url.includes('/docket/2/meta'))?.access,
    ).toBe('docket metadata only');
    expect(
      links.find((link) => link.url.includes('/opinion/3/full'))?.access,
    ).toBe('page content read');
  });

  it('keeps each URL once and records a source category', () => {
    const links = uniqueSourceLinks({
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI',
          summary: 'PubMed record.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/?utm_source=report',
        },
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Duplicate PubMed listing',
          summary: 'Same page.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
        },
      ],
      identity: {
        status: 'ambiguous',
        identity: null,
        basis: [],
        note: 'Possible NPI in another city.',
        notes: [],
        candidates: [
          {
            npi: '1234567893',
            name: 'Leah Ellenberg, PhD',
            credential: 'PhD',
            taxonomy: 'Clinical Neuropsychologist',
            city: 'BEVERLY HILLS',
            state: 'CA',
            url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
          },
        ],
      },
      cvCheck: {
        document: {
          id: 'cv-1',
          name: 'cv.pdf',
          pageCount: 1,
          unreadablePages: [],
          ocrPages: [],
        },
        status: 'completed',
        claims: [],
        warnings: [],
        comparisons: [
          {
            id: 'cvc-1',
            topic: 'publication',
            label: 'verified',
            severity: 'low',
            title: 'Verified match',
            cv: null,
            source: {
              name: 'PubMed',
              statement: 'Same citation.',
              url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
            },
            note: '',
          },
        ],
      },
      webResearch: {
        ranAt: '2026-10-26T12:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 0,
        queriesRun: 0,
        providers: [],
        pagesRead: 1,
        pagesBlocked: [],
        candidates: [],
        records: [
          {
            id: 'web-1',
            url: 'https://example.test/practice',
            title: 'Practice page',
            kind: 'expert_website',
            snippet: null,
            summary: 'Own site.',
            publishedAt: null,
            retrievedAt: '2026-10-26T12:00:00.000Z',
            searchProviders: [],
            queries: [],
            read: 'read',
            readNote: null,
            match: {
              level: 'strong',
              confidence: 'high',
              basis: ['name'],
              conflicts: [],
              quote: null,
              quoteVerified: false,
              classifiedBy: 'rules',
            },
            candidateId: null,
            claims: [],
          },
        ],
        registries: [],
        limitations: [],
      },
    });

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.url).sort()).toEqual([
      'https://example.test/practice',
      'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
      'https://pubmed.ncbi.nlm.nih.gov/11111111',
    ]);
    expect(links.find((link) => link.url.includes('pubmed'))?.category).toBe(
      'Publication',
    );
    expect(links.find((link) => link.url.includes('pubmed'))?.attribution).toBe(
      'subject',
    );
    expect(
      links.find((link) => link.url.includes('npiregistry'))?.category,
    ).toBe('NPI Registry');
    expect(
      links.find((link) => link.url.includes('npiregistry'))?.attribution,
    ).toBe('possible');
    expect(
      links.find((link) => link.url.includes('example.test'))?.category,
    ).toBe('Expert Website');
    expect(
      links.find((link) => link.url.includes('example.test'))?.attribution,
    ).toBe('subject');
  });

  it('keeps an unrelated expert profile out of subject sources', () => {
    const links = uniqueSourceLinks({
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI',
          summary: 'PubMed record.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
        },
      ],
      webResearch: {
        ranAt: '2026-10-26T12:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 0,
        queriesRun: 0,
        providers: [],
        pagesRead: 1,
        pagesBlocked: [],
        candidates: [],
        records: [
          {
            id: 'other-1',
            url: 'https://psychologytoday.com/leila-glass',
            title: 'Leila Glass, PhD',
            kind: 'directory',
            snippet: null,
            summary: 'Another neuropsychologist.',
            publishedAt: null,
            retrievedAt: '2026-10-26T12:00:00.000Z',
            searchProviders: [],
            queries: [],
            read: 'snippet_only',
            readNote: null,
            match: {
              level: 'other_person',
              confidence: 'medium',
              basis: ['different first name'],
              conflicts: ['Leila Glass'],
              quote: 'Leila Glass, PhD',
              quoteVerified: true,
              classifiedBy: 'rules',
            },
            candidateId: 'cand-other-1',
            claims: [],
          },
        ],
        registries: [],
        limitations: [],
      },
    });
    expect(
      links.find((link) => link.url.includes('11111111'))?.attribution,
    ).toBe('subject');
    expect(
      links.find((link) => link.url.includes('leila-glass'))?.attribution,
    ).toBe('other');
    expect(
      links.find((link) => link.url.includes('leila-glass'))?.category,
    ).toMatch(/not this person/i);
  });

  it('keeps a possible-match directory out of subject sources and notes snippet-only access', () => {
    const links = uniqueSourceLinks({
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI',
          summary: 'PubMed record.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
        },
      ],
      webResearch: {
        ranAt: '2026-10-26T12:00:00.000Z',
        durationMs: 1,
        partial: false,
        partialNote: null,
        queriesPlanned: 0,
        queriesRun: 0,
        providers: [],
        pagesRead: 0,
        pagesBlocked: [],
        candidates: [],
        records: [
          {
            id: 'possible-1',
            url: 'https://www.expertinstitute.com/experts/other-jason/',
            title: 'Jason Other, PhD',
            kind: 'directory',
            snippet: 'Jason Other neuropsychologist',
            summary: 'Directory listing.',
            publishedAt: null,
            retrievedAt: '2026-10-26T12:00:00.000Z',
            searchProviders: [],
            queries: [],
            read: 'snippet_only',
            readNote: null,
            match: {
              level: 'possible',
              confidence: 'medium',
              basis: ['surname'],
              conflicts: [],
              quote: null,
              quoteVerified: false,
              classifiedBy: 'rules',
            },
            candidateId: 'cand-possible-1',
            claims: [],
          },
        ],
        registries: [],
        limitations: [],
      },
    });
    const possible = links.find((link) =>
      link.url.includes('expertinstitute.com'),
    );
    expect(possible?.attribution).toBe('possible');
    expect(possible?.category).toMatch(/possible match/i);
    expect(possible?.access).toBe('search result only');
    expect(
      links.find((link) => link.url.includes('11111111'))?.attribution,
    ).toBe('subject');
  });

  it('returns an empty list when no URLs were collected', () => {
    expect(
      uniqueSourceLinks({
        evidence: [
          {
            sourceId: 'pubmed',
            category: 'publication',
            title: 'No URL on this record',
            summary: 'Catalog miss.',
          },
        ],
        identity: {
          status: 'not_found',
          identity: null,
          basis: [],
          note: 'No NPI record.',
          notes: [],
          candidates: [],
        },
      }),
    ).toEqual([]);
  });
});

describe('source-links PDF', () => {
  it('builds a clickable unique-links PDF without a contents page', async () => {
    const input = {
      expertName: 'Leah Ellenberg',
      city: 'Los Angeles',
      specialty: 'Neuropsychology',
      evidence: [
        {
          sourceId: 'pubmed',
          category: 'publication',
          title: 'Memory after pediatric TBI',
          summary: 'PubMed record.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
        },
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
    };
    const document = buildEwiSourceLinksDocument(input);
    expect(document.templateId).toBe(EWI_SOURCE_LINKS_TEMPLATE_ID);
    expect(document.templateVersion).toBe(EWI_REPORT_TEMPLATE_VERSION);
    expect(document.includeTableOfContents).toBe(false);
    expect(document.fileName).toBe('ewi-leah-ellenberg-source-links.pdf');
    expect(document.sections).toHaveLength(1);

    const service = new EwiPdfReportService(new PdfReportRenderer());
    const artifact = await service.buildSourceLinks(input);
    expect(artifact.templateId).toBe(EWI_SOURCE_LINKS_TEMPLATE_ID);
    expect(artifact.fileName).toBe('ewi-leah-ellenberg-source-links.pdf');
    expect(artifact.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const raw = artifact.buffer.toString('latin1');
    expect(raw).toMatch(
      /\/URI\s*\(https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/11111111\/?\)/,
    );

    const parsed = await new PdfParser().parse({
      filePath: 'links.pdf',
      buffer: artifact.buffer,
      filename: 'links.pdf',
      extension: 'pdf',
      fileSize: artifact.buffer.byteLength,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    const text = parsed.pages.map((page) => page.text).join('\n');
    expect(text).toContain('1 subject source(s)');
    expect(text).toMatch(/not proof that the page was read/i);
    expect(text).toContain('Memory after pediatric TBI');
    expect(text).toContain('Category: Publication.');
    expect(text).toContain('https://pubmed.ncbi.nlm.nih.gov/11111111');
    expect(text).not.toContain('Contents');
  }, 20000);

  it('builds an empty source-links PDF that says no URLs were collected', async () => {
    const service = new EwiPdfReportService(new PdfReportRenderer());
    const artifact = await service.buildSourceLinks({
      expertName: 'Leah Ellenberg',
      city: 'Los Angeles',
      specialty: 'Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-10-26T12:00:00.000Z',
    });
    expect(artifact.fileName).toBe('ewi-leah-ellenberg-source-links.pdf');
    const parsed = await new PdfParser().parse({
      filePath: 'empty-links.pdf',
      buffer: artifact.buffer,
      filename: 'empty-links.pdf',
      extension: 'pdf',
      fileSize: artifact.buffer.byteLength,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    const text = parsed.pages.map((page) => page.text).join('\n');
    expect(text).toContain('0 subject source(s)');
    expect(text).toContain('No source URLs were collected.');
  }, 20000);
});
