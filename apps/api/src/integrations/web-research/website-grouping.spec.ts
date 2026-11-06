import {
  groupWebsitesByHost,
  pageLooksRelevant,
} from './website-grouping';
import { canonicalUrl } from './web-research-engine';
import { normalizeFindingUrl } from './evidence-gate';
import { collapseWebsiteFindingsByHost } from './section-router';
import type { RoutedFinding } from './section-router';
import { buildEwiReportDocument } from '../../modules/ewi/report/ewi-report.template';
import type {
  OnlinePresenceDossier,
  PresenceRecord,
} from '../../modules/ewi/research/online-presence';

describe('URL canonicalization parity', () => {
  it('2–5. http/https, www, trailing slash, tracking params unify', () => {
    const a = canonicalUrl('http://www.Example.com/about/?utm_source=x#top');
    const b = normalizeFindingUrl('https://example.com/about');
    expect(a).toBe(b);
    expect(a).toBe('https://example.com/about');
  });

  it('12. duplicate spellings share one key', () => {
    expect(normalizeFindingUrl('https://www.example.com/cv/')).toBe(
      normalizeFindingUrl('http://example.com/cv?utm_campaign=1'),
    );
  });
});

describe('pageLooksRelevant', () => {
  it('7. keeps relevant and drops pure privacy fluff', () => {
    expect(pageLooksRelevant('About', 'Professional biography', '/about')).toBe(
      true,
    );
    expect(pageLooksRelevant('Privacy', 'Cookie policy only', '/privacy')).toBe(
      false,
    );
  });
});

describe('groupWebsitesByHost', () => {
  it('1. same domain multiple pages → one host group', () => {
    const groups = groupWebsitesByHost([
      {
        url: 'https://www.practice.example/about',
        title: 'About',
        summary: 'Professional biography of the expert',
        owned: true,
      },
      {
        url: 'https://practice.example/',
        title: 'Home',
        summary: 'Main professional website',
        owned: true,
      },
      {
        url: 'http://practice.example/forensic/',
        title: 'Forensic Evaluations',
        summary: 'Forensic evaluation services offered',
        owned: true,
      },
      {
        url: 'https://practice.example/privacy',
        title: 'Privacy',
        summary: 'Cookie policy',
        owned: true,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].host).toBe('practice.example');
    expect(groups[0].subpages.some((p) => p.path === '/about')).toBe(true);
    expect(groups[0].subpages.some((p) => p.path === '/forensic')).toBe(true);
    expect(groups[0].subpages.some((p) => p.path === '/privacy')).toBe(false);
  });

  it('excludes Google Drive CV download hosts from Expert Websites', () => {
    const groups = groupWebsitesByHost([
      {
        url: 'https://drive.usercontent.google.com/download?id=abc&export=download',
        title: 'Curriculum Vitae',
        summary: 'CV PDF download for the expert',
        owned: false,
      },
      {
        url: 'https://drnicolegraham.com/',
        title: 'Practice site',
        summary: 'Forensic neuropsychology practice website',
        owned: true,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].host).toBe('drnicolegraham.com');
  });

  it('10. two distinct owned hosts stay separate', () => {
    const groups = groupWebsitesByHost([
      {
        url: 'https://alpha.example/',
        title: 'Alpha',
        summary: 'Practice site',
        owned: true,
      },
      {
        url: 'https://beta.example/',
        title: 'Beta',
        summary: 'Another practice site',
        owned: true,
      },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('11. distinct subdomain not merged with apex', () => {
    const groups = groupWebsitesByHost([
      {
        url: 'https://example.com/',
        title: 'Main',
        summary: 'Main site',
        owned: true,
      },
      {
        url: 'https://blog.example.com/',
        title: 'Blog',
        summary: 'Blog subdomain',
        owned: true,
      },
    ]);
    expect(groups.map((g) => g.host).sort()).toEqual([
      'blog.example.com',
      'example.com',
    ]);
  });

  it('8–9. ownership labels distinguish owned vs uncertain', () => {
    const groups = groupWebsitesByHost([
      {
        url: 'https://owned.example/',
        title: 'Owned',
        summary: 'Practice',
        owned: true,
      },
      {
        url: 'https://mention.example/',
        title: 'Mention',
        summary: 'Third party mention',
        owned: false,
      },
    ]);
    expect(groups.find((g) => g.host === 'owned.example')?.ownershipLabel).toMatch(
      /own professional website/i,
    );
    expect(
      groups.find((g) => g.host === 'mention.example')?.ownershipLabel,
    ).toMatch(/ownership not established/i);
  });
});

function finding(
  partial: Partial<RoutedFinding> & Pick<RoutedFinding, 'url' | 'statement'>,
): RoutedFinding {
  return {
    sectionId: 'websites',
    title: partial.title ?? 'Website',
    statement: partial.statement,
    quote: partial.quote ?? null,
    url: partial.url,
    sourceTitle: partial.sourceTitle ?? 'site',
    basis: partial.basis ?? 'subject_stated',
    basisLabel: partial.basisLabel ?? 'Own site',
    matchLevel: partial.matchLevel ?? 'strong',
    from: partial.from ?? 'page',
    retrievedAt: partial.retrievedAt ?? '2026-11-06T00:00:00.000Z',
    publishedAt: null,
    verification: null,
    kind: partial.kind ?? 'expert_website',
    searchProviders: [],
    read: 'read',
    rating: null,
  };
}

describe('collapseWebsiteFindingsByHost', () => {
  it('14. credentials fold under host card, not separate websites', () => {
    const collapsed = collapseWebsiteFindingsByHost([
      finding({
        url: 'https://practice.example/about',
        title: 'Board certification (own statement)',
        statement:
          'Own statement of board certification — not independent verification.',
      }),
      finding({
        url: 'https://practice.example/',
        title: 'Website',
        statement: 'Main professional website.',
        basis: 'record',
      }),
      finding({
        url: 'https://practice.example/cv',
        title: 'Publications (own publication list)',
        statement: 'Own publication list — not independent verification.',
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].statement).toMatch(/Also listed:/i);
    expect(collapsed[0].statement).toMatch(/Self-reported on this site:/i);
  });
});

describe('Expert Websites report grouping', () => {
  function presence(
    partial: Partial<PresenceRecord> & Pick<PresenceRecord, 'url' | 'title'>,
  ): PresenceRecord {
    return {
      id: partial.id ?? partial.url!,
      kind: partial.kind ?? 'expert_website',
      title: partial.title,
      url: partial.url,
      sourceId: 'web_search',
      sourceName: 'Web',
      retrievedAt: '2026-11-06T00:00:00.000Z',
      publishedAt: null,
      summary: partial.summary ?? 'Professional biography page',
      relevantClaims: [],
      advertisingClaims: [],
      forensicClaims: [],
      expertWitnessClaims: [],
      treatmentPracticeInfo: null,
      conflictOrBiasIndicators: [],
      evidenceReferences: [],
      restricted: false,
      identityMatch: 'matched',
      platform: null,
      description: null,
      transcript: null,
      transcriptAvailable: null,
      transcriptUnavailableReason: null,
      importantStatements: [],
      rating: null,
      reviewDate: null,
      reviewText: null,
      neutralSummary: null,
      address: null,
      businessName: null,
      locationFlags: [],
      locationNote: null,
    };
  }

  it('1+17. presence + multi-path same host → one Expert Website card', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      onlinePresence: {
        websites: [
          presence({
            url: 'https://www.practice.example/',
            title: 'Home',
            summary: 'Main professional website',
          }),
          presence({
            url: 'https://practice.example/about',
            title: 'About',
            summary: 'Professional biography',
          }),
          presence({
            url: 'https://practice.example/forensic',
            title: 'Forensic',
            summary: 'Forensic evaluation services',
          }),
        ],
        directories: [],
        ime: [],
        videos: [],
        social: [],
        newsAndBlogs: [],
        patientReviews: [],
        locations: [],
        otherPublicSites: [],
        records: [],
        sourceAttempts: [],
      } satisfies OnlinePresenceDossier,
    });
    const section = document.sections.find((s) => s.id === 'websites');
    const text = section!.blocks.map((b) => b.text).join('\n');
    const hostHeadings = section!.blocks.filter((b) =>
      /^Expert Website:/i.test(b.text),
    );
    expect(hostHeadings).toHaveLength(1);
    expect(text).toMatch(/practice\.example/);
    expect(text).toMatch(/Relevant pages on this site/i);
    expect(text).toMatch(/\/about|\/forensic/);
  });

  it('16. Source Index groups owned website paths under one host', () => {
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Psychology',
      evidence: [
        {
          id: 'e1',
          sourceId: 'web_search',
          category: 'expert_website',
          title: 'Home',
          url: 'https://practice.example/',
          statement: 'Home',
          retrievedAt: '2026-11-06T00:00:00.000Z',
          access: 'public',
        },
        {
          id: 'e2',
          sourceId: 'web_search',
          category: 'expert_website',
          title: 'About',
          url: 'https://practice.example/about',
          statement: 'About',
          retrievedAt: '2026-11-06T00:00:00.000Z',
          access: 'public',
        },
        {
          id: 'e3',
          sourceId: 'npi_registry',
          category: 'license',
          title: 'NPI',
          url: 'https://npiregistry.cms.hhs.gov/1',
          statement: 'NPI',
          retrievedAt: '2026-11-06T00:00:00.000Z',
          access: 'public',
        },
      ] as never,
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
    });
    const section = document.sections.find((s) => s.id === 'source-index');
    const text = section!.blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/\[expert website\] practice\.example/);
    expect(text).toMatch(/Also:/);
    expect(text).toMatch(/npi_registry/);
  });
});
