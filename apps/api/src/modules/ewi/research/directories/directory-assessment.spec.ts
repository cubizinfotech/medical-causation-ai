import { buildEwiReportDocument } from '../../report/ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from '../../report/ewi-report.version';
import {
  assessDirectoryListings,
  assessDirectoryListingsFromMaterials,
} from './directory-assessment';
import {
  DIRECTORY_REGISTRY,
  directoryById,
  isAdvertisingDirectoryHost,
  resolveAdvertisingDirectory,
} from './directory-registry';
import type { RegisteredAdvertisingDirectory } from './directory-registry';

const CORE = DIRECTORY_REGISTRY.filter((d) =>
  ['jurispro', 'seak', 'expertpages', 'dri'].includes(d.id),
);

function only(...ids: string[]): readonly RegisteredAdvertisingDirectory[] {
  return DIRECTORY_REGISTRY.filter((d) => ids.includes(d.id));
}

const JURISPRO_STRONG = {
  url: 'https://www.jurispro.com/expert/jane-expert',
  title: 'Jane Expert — JurisPro',
  text: `
    Jane Expert, Ph.D.
    Clinical Neuropsychology
    Tampa, FL
    Expert witness and IME services
  `,
};

const SEAK_STRONG = {
  url: 'https://www.seakexperts.com/experts/jane-expert',
  title: 'Jane Expert — SEAK',
  text: `
    Jane Expert, PhD
    Clinical Neuropsychology
    Tampa Florida
    Available for expert witness work
  `,
};

const EXPERTPAGES_STRONG = {
  url: 'https://www.expertpages.com/experts/jane-expert.htm',
  title: 'Jane Expert ExpertPages listing',
  text: `
    Jane Expert, Ph.D. — Clinical Neuropsychology — Tampa, FL
    Forensic and IME evaluations
  `,
};

describe('directory registry', () => {
  it('resolves JurisPro, SEAK, ExpertPages hosts', () => {
    expect(resolveAdvertisingDirectory('https://www.jurispro.com/x')?.id).toBe(
      'jurispro',
    );
    expect(resolveAdvertisingDirectory('seakexperts.com')?.id).toBe('seak');
    expect(resolveAdvertisingDirectory('https://expertpages.com/a')?.id).toBe(
      'expertpages',
    );
    expect(isAdvertisingDirectoryHost('https://jurispro.com/expert/1')).toBe(
      true,
    );
    expect(isAdvertisingDirectoryHost('https://practice.example/about')).toBe(
      false,
    );
    expect(directoryById('dri')?.searchMethod).toBe('none');
  });

  it('10. third-party directory is not treated as an owned practice host helper', () => {
    expect(
      isAdvertisingDirectoryHost('https://www.seakexperts.com/experts/x'),
    ).toBe(true);
    expect(isAdvertisingDirectoryHost('https://drpractice.example/')).toBe(
      false,
    );
  });
});

describe('assessDirectoryListingsFromMaterials', () => {
  it('1. verified JurisPro profile → Profile Found', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      { jurispro: [JURISPRO_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('profile_found');
    expect(dossier.assessments[0].profileUrl).toContain('jurispro.com');
  });

  it('2. verified SEAK profile → Profile Found', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      { seak: [SEAK_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('seak'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('profile_found');
  });

  it('3. verified ExpertPages profile → Profile Found', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      { expertpages: [EXPERTPAGES_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('expertpages'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('profile_found');
  });

  it('4. successful search with no match → No Matching Public Profile Found', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      { jurispro: [] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro'),
        searchAttempted: true,
        dossierTopicsRan: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('no_matching_public_profile');
    expect(dossier.assessments[0].explanation).not.toMatch(/Not Checked/i);
  });

  it('5. inaccessible directory → Unable to Access (not no listing)', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {
        jurispro: [
          {
            url: 'https://www.jurispro.com/expert/locked',
            title: 'Login required',
            text: 'Please sign in',
            restricted: true,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro'),
        loginBlocked: true,
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('unable_to_access');
    expect(dossier.assessments[0].explanation).not.toMatch(
      /No Matching Public Profile/i,
    );
  });

  it('6. search not supported (DRI) → Search Not Supported', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {},
      {
        expertName: 'Jane Expert',
        directories: only('dri'),
      },
    );
    expect(dossier.assessments[0].status).toBe('search_not_supported');
  });

  it('7. similar-name profile rejected as identity mismatch', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {
        jurispro: [
          {
            url: 'https://www.jurispro.com/expert/john-expert',
            title: 'John Expert — Cardiology',
            text: `
              John Expert, M.D.
              Cardiology
              Boston, MA
            `,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro'),
        searchAttempted: true,
        dossierTopicsRan: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('no_matching_public_profile');
    expect(dossier.assessments[0].profileUrl).toBeNull();
    expect(dossier.assessments[0].limitations.join(' ')).toMatch(
      /identity mismatch/i,
    );
  });

  it('rejects JurisPro article PDFs as directory profiles', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {
        jurispro: [
          {
            url: 'https://www.jurispro.com/files/articles/thestirmreport_9985.pdf',
            title: 'METHUEN POLICE DEPARTMENT INTERNAL INVESTIGATION',
            text: 'Nicole Graham appears in unrelated article text about police department risk mitigation in Massachusetts.',
            searchResultOnly: false,
          },
        ],
      },
      {
        expertName: 'Nicole Graham',
        specialty: 'neuropsychology',
        city: 'Florida',
        directories: only('jurispro'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('no_matching_public_profile');
    expect(dossier.assessments[0].profileUrl).toBeNull();
  });

  it('8. snippet-only potential match is not verified', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {
        seak: [
          {
            url: 'https://www.seakexperts.com/experts/jane-expert',
            title: 'Jane Expert',
            text: 'Jane Expert Clinical Neuropsychology Tampa',
            searchResultOnly: true,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('seak'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('potential_match_unconfirmed');
    expect(dossier.assessments[0].status).not.toBe('profile_found');
  });

  it('11. duplicate paths consolidate to one assessment per directory', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {
        jurispro: [
          JURISPRO_STRONG,
          {
            ...JURISPRO_STRONG,
            url: 'https://jurispro.com/expert/jane-expert/',
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro'),
        searchAttempted: true,
      },
    );
    expect(dossier.assessments).toHaveLength(1);
    expect(dossier.assessments[0].status).toBe('profile_found');
  });
});

describe('assessDirectoryListings async', () => {
  it('dedupes SERP hits by canonical URL and prefers fetched pages', async () => {
    const dossier = await assessDirectoryListings({
      expertName: 'Jane Expert',
      specialty: 'Clinical Neuropsychology',
      city: 'Tampa, FL',
      directories: only('jurispro'),
      search: () =>
        Promise.resolve([
          {
            url: 'https://www.jurispro.com/expert/jane-expert',
            title: 'Jane Expert',
            snippet: 'Jane Expert neuropsychology',
          },
          {
            url: 'http://jurispro.com/expert/jane-expert/',
            title: 'Jane Expert dup',
            snippet: 'duplicate',
          },
        ]),
      fetchPage: (url) =>
        Promise.resolve({
          url,
          title: 'Jane Expert — JurisPro',
          text: JURISPRO_STRONG.text,
          retrievedAt: '2026-11-06T00:00:00.000Z',
        }),
    });
    expect(dossier.assessments[0].status).toBe('profile_found');
    expect(dossier.assessments[0].evidence?.searchResultOnly).toBe(false);
  });
});

describe('report section presentation', () => {
  it('9. practice site is not classified as advertising in §21 assessments', () => {
    const dossier = assessDirectoryListingsFromMaterials(
      {},
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: CORE,
        searchAttempted: true,
        dossierTopicsRan: true,
      },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [
        {
          id: 'site',
          sourceId: 'web_search',
          category: 'expert_website',
          title: 'Practice home',
          url: 'https://practice.example/',
          statement: 'IME available',
          retrievedAt: '2026-11-06T00:00:00.000Z',
          access: 'public',
        } as never,
      ],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      directoryAssessments: dossier,
      onlinePresence: {
        websites: [
          {
            id: 'w1',
            kind: 'expert_website',
            title: 'Practice',
            url: 'https://practice.example/',
            sourceId: 'web_search',
            sourceName: 'Web',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            publishedAt: null,
            summary: 'IME and forensic services on practice site',
            relevantClaims: [],
            advertisingClaims: ['IME available'],
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
          },
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
      },
    });
    const ime = document.sections.find((s) => s.id === 'ime')!;
    const text = ime.blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/JurisPro|SEAK|ExpertPages/);
    expect(text).not.toMatch(/practice\.example/);
    expect(document.sections.find((s) => s.id === 'websites')).toBeTruthy();
  });

  it('12. directory findings appear in §21 and Source Index', () => {
    const assessments = assessDirectoryListingsFromMaterials(
      {
        jurispro: [JURISPRO_STRONG],
        seak: [SEAK_STRONG],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        directories: only('jurispro', 'seak'),
        searchAttempted: true,
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
      directoryAssessments: assessments,
    });
    expect(EWI_REPORT_TEMPLATE_VERSION).toBe('3.10.27');
    const ime = document.sections.find((s) => s.id === 'ime')!;
    expect(ime.title).toMatch(/Expert Witness Advertising/i);
    const imeText = ime.blocks.map((b) => b.text).join('\n');
    expect(imeText).toMatch(/Profile Found/);
    expect(imeText).toMatch(/jurispro\.com/i);
    expect(imeText).toMatch(/seakexperts\.com/i);
    const index = document.sections.find((s) => s.id === 'source-index')!;
    const indexText = index.blocks.map((b) => b.text).join('\n');
    expect(indexText).toMatch(/jurispro\.com|JurisPro/i);
  });

  it('13. Expert Website host grouping still works alongside directory assessments', () => {
    const assessments = assessDirectoryListingsFromMaterials(
      {},
      {
        expertName: 'Jane Expert',
        directories: only('jurispro'),
        searchAttempted: true,
        dossierTopicsRan: true,
      },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Psychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      directoryAssessments: assessments,
      onlinePresence: {
        websites: [
          {
            id: 'a',
            kind: 'expert_website',
            title: 'Home',
            url: 'https://practice.example/',
            sourceId: 'web_search',
            sourceName: 'Web',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            publishedAt: null,
            summary: 'Main professional website',
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
          },
          {
            id: 'b',
            kind: 'expert_website',
            title: 'About',
            url: 'https://practice.example/about',
            sourceId: 'web_search',
            sourceName: 'Web',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            publishedAt: null,
            summary: 'Professional biography',
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
          },
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
      },
    });
    const websites = document.sections.find((s) => s.id === 'websites')!;
    const headings = websites.blocks.filter((b) =>
      /^Expert Website:/i.test(b.text),
    );
    expect(headings).toHaveLength(1);
  });
});
