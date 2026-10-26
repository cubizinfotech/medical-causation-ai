/* eslint-disable @typescript-eslint/require-await -- test doubles */
/**
 * Regression for the Jason A. Demery report (3.2.0): the web run had found
 * the board certification, AACN directory entry, degrees, UF article, company
 * and federal orders, yet sections 9, 10, 13–16, 23–24, 26, 35 and 37 printed
 * "Nothing in this section was confirmed". The pages below carry the passages
 * that report quoted; the whole path (engine → router → template) is real,
 * only the network is replaced.
 */
import {
  WebResearchEngine,
  type SearchHit,
  type SearchProvider,
  type WebResearchDossier,
  type WebResearchSettings,
} from '@integrations/web-research';
import type {
  FetchedPage,
  SafeFetcher,
} from '../../../integrations/web-research/safe-fetcher';
import { buildEwiReportDocument } from './ewi-report.template';

const settings: WebResearchSettings = {
  providers: [],
  maxQueries: 44,
  maxPages: 50,
  searchTimeoutMs: 1000,
  fetchTimeoutMs: 1000,
  maxFetchPages: 30,
  deadlineMs: 120_000,
};

const NS_ABOUT = 'https://neuropsychologicalsciences.com/about';
const AACN = 'https://www.theaacn.org/member-directory/11708';
const EXPERT_INSTITUTE =
  'https://www.expertinstitute.com/experts/jason-demery/';
const PMC = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5516044/';
const ORDER = 'https://ecf.flmd.uscourts.gov/doc1/madison-order';
const MOTION = 'https://ecf.flmd.uscourts.gov/doc1/roberts-motion-to-compel';
const VIDEO = 'https://www.youtube.com/watch?v=dQPVnCi9EyQ';
const SUNBIZ = 'https://search.sunbiz.org/Inquiry/CorporationSearch/Detail';
const OTHER_PERSON = 'https://roofing.example/team/jason-b-demery';

function page(url: string, title: string, text: string): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: 'read',
    note: null,
    title,
    description: null,
    publishedAt: null,
    text,
  };
}

const PAGES: Record<string, FetchedPage> = {
  [NS_ABOUT]: page(
    NS_ABOUT,
    'About Dr. Demery | Neuropsychological Sciences',
    'Dr. Jason A. Demery, Ph.D., ABPP is a clinical neuropsychologist in Gainesville, Florida. Board Certified in Clinical Neuropsychology by the American Board of Professional Psychology (ABPP-CN). Dr. Demery earned his Ph.D. in Clinical Psychology from the University of Florida. He provides forensic neuropsychological evaluations and independent medical examinations for attorneys. Neuropsychological Sciences, LLC, 8491 NW 39th Ave, Gainesville, FL 32606.',
  ),
  [AACN]: page(
    AACN,
    'Jason A. Demery, PhD, ABPP | AACN member directory',
    'Jason A. Demery, PhD, ABPP. Certified specialist in Gainesville, Florida. Clinical Neuropsychology. American Academy of Clinical Neuropsychology (AACN) member directory.',
  ),
  [EXPERT_INSTITUTE]: page(
    EXPERT_INSTITUTE,
    'Jason A. Demery, PhD, ABPP | Neuropsychology Expert Witness',
    'Jason A. Demery, PhD, ABPP is a neuropsychology expert witness in Gainesville, Florida. He earned an AA from Saint Leo University, a BA from University of West Florida, an MA from Southern Illinois University and a PhD from University of Florida.',
  ),
  [PMC]: page(
    PMC,
    'Cognitive outcomes after mild traumatic brain injury - PMC',
    'Demery JA, Hanks RA. Neuropsychological outcomes after mild traumatic brain injury, published in the Journal of Neuropsychology in 2017. Jason A. Demery, UF Forensic Institute, UF Springhill Health Center, 8491 NW 39th Ave., Gainesville, Florida. Clinical neuropsychology research on memory after injury.',
  ),
  [ORDER]: page(
    ORDER,
    'Order - United States v. Madison',
    'ORDER. The Court appointed Jason Demery, Ph.D., ABPP, a board-certified clinical neuropsychologist in Gainesville, to evaluate the defendant. It is hereby ordered that the motion for a competency evaluation is granted.',
  ),
  [MOTION]: page(
    MOTION,
    'Motion to compel examination - Roberts v. Example Insurance',
    'Plaintiff files this motion to compel a neuropsychological examination by Dr. Jason A. Demery, Ph.D., ABPP, a clinical neuropsychologist in Gainesville, Florida. The memorandum states that Dr. Demery will conduct the examination.',
  ),
  [VIDEO]: page(
    VIDEO,
    'Brain injury and the courtroom',
    'Dr. Jason Demery is a board-certified neuropsychologist in Gainesville who has testified about 300 times in court as an expert witness on brain injury.',
  ),
  [SUNBIZ]: {
    url: SUNBIZ,
    finalUrl: SUNBIZ,
    status: 'restricted',
    botBlocked: true,
    note: 'The site answered with a bot-protection page (HTTP 403). It was not bypassed.',
  },
  [OTHER_PERSON]: page(
    OTHER_PERSON,
    'Our team',
    'Jason B. Demery is the owner of Demery Roofing in Dallas, TX. Jason B. Demery has installed roofs across north Texas for twenty years and offers free estimates to residential customers.',
  ),
};

const HITS: Array<Pick<SearchHit, 'url' | 'title' | 'snippet'>> = [
  {
    url: NS_ABOUT,
    title: PAGES[NS_ABOUT].title ?? '',
    snippet: 'Jason A. Demery neuropsychologist Gainesville',
  },
  {
    url: AACN,
    title: PAGES[AACN].title ?? '',
    snippet: 'Jason A. Demery certified specialist',
  },
  {
    url: EXPERT_INSTITUTE,
    title: PAGES[EXPERT_INSTITUTE].title ?? '',
    snippet: 'Jason A. Demery PhD ABPP',
  },
  { url: PMC, title: PAGES[PMC].title ?? '', snippet: 'Demery JA' },
  { url: ORDER, title: PAGES[ORDER].title ?? '', snippet: 'Jason Demery ABPP' },
  {
    url: MOTION,
    title: PAGES[MOTION].title ?? '',
    snippet: 'Jason A. Demery motion to compel',
  },
  { url: VIDEO, title: PAGES[VIDEO].title ?? '', snippet: 'Jason Demery' },
  { url: SUNBIZ, title: 'Neuropsychological Sciences LLC', snippet: '' },
  {
    url: OTHER_PERSON,
    title: 'Our team',
    snippet: 'Jason B. Demery owner Demery Roofing',
  },
];

function fetcher(): SafeFetcher {
  return {
    fetchPage: async (url: string): Promise<FetchedPage> =>
      PAGES[url] ?? {
        url,
        finalUrl: url,
        status: 'failed',
        note: 'The page could not be reached.',
      },
  } as unknown as SafeFetcher;
}

/** Answers every question with the same pages, except a search of abpp.org, which returns nothing. */
function provider(): SearchProvider {
  return {
    id: 'gemini_grounding',
    name: 'Gemini Search',
    kinds: ['web', 'news', 'scholar'],
    budget: 60,
    concurrency: 3,
    isConfigured: () => true,
    async search(request) {
      if (request.query.includes('site:abpp.org')) return [];
      return HITS.map((entry) => ({
        ...entry,
        providerId: 'gemini_grounding',
        query: request.query,
        kind: request.kind,
      }));
    },
  };
}

const base = {
  expertName: 'Jason A. Demery',
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
  evidence: [],
  discrepancies: [],
  questions: [],
  generatedAt: '2026-10-20T12:00:00.000Z',
};

const GENERIC = 'Nothing in this section was confirmed';

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

describe('Demery report regression', () => {
  let dossier: WebResearchDossier;
  let document: ReturnType<typeof buildEwiReportDocument>;

  beforeAll(async () => {
    const engine = new WebResearchEngine({
      settings,
      providers: [provider()],
      fetcher: fetcher(),
    });
    dossier = await engine.run({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    document = buildEwiReportDocument({ ...base, webResearch: dossier });
  });

  it('keeps the other Jason Demery out of every section', () => {
    const section39 = sectionText(document, 'web-research');
    expect(section39).toContain('a different person');
    expect(section39).toContain('Jason B. Demery');
    const outside = document.sections
      .filter((section) => section.id !== 'web-research')
      .flatMap((section) => section.blocks.map((block) => block.text))
      .join('\n');
    expect(outside).not.toContain('Jason B. Demery');
    expect(outside).not.toContain('roofing.example');
    expect(outside).not.toContain('Texas');
  });

  it('files the board certification and names the certifying organization', () => {
    const certifications = sectionText(document, 'board-certifications');
    expect(certifications).toMatch(/ABPP/);
    expect(certifications).not.toContain(GENERIC);
    expect(certifications).not.toContain(ORDER);
    expect(sectionText(document, 'ime')).not.toContain(ORDER);
    const organizations = sectionText(document, 'certification-orgs');
    expect(organizations).toMatch(
      /American Board of Professional Psychology|ABPP/,
    );
    expect(organizations).not.toContain(GENERIC);
  });

  it('says the certification is claimed but not confirmed at abpp.org, and the AACN entry is the source for membership', () => {
    const certification = dossier.verifications?.find(
      (v) => v.topic === 'board_certification',
    );
    expect(certification?.status).toBe('not_confirmed');
    expect(certification?.note).toMatch(/abpp\.org/);
    expect(certification?.claimedAt.length).toBeGreaterThan(0);
    const membership = dossier.verifications?.find(
      (v) => v.topic === 'membership',
    );
    expect(membership?.status).toBe('confirmed');
    expect(membership?.confirmedBy?.url).toBe(AACN);
    expect(sectionText(document, 'board-certifications')).toMatch(
      /not confirmed at the source/i,
    );
    expect(sectionText(document, 'memberships')).toMatch(/Confirmed on/);
  });

  it('lists degrees and the degree-granting institutions without claiming accreditation', () => {
    const education = sectionText(document, 'education');
    expect(education).toMatch(/University of Florida/);
    expect(education).not.toContain(GENERIC);
    const accreditation = sectionText(document, 'university-accreditation');
    expect(accreditation).not.toMatch(/University of Florida/);
    expect(accreditation).not.toMatch(/not checked against an accreditor/);
    expect(accreditation).toMatch(
      /dedicated search for this topic ran|Public accreditation listings were searched/i,
    );
    expect(accreditation).not.toMatch(/not implemented/i);
  });

  it('files the article, the company, the address and the court documents', () => {
    expect(sectionText(document, 'publications')).toMatch(
      /PMC|Cognitive outcomes/,
    );
    expect(sectionText(document, 'corporate')).toMatch(
      /Neuropsychological Sciences/,
    );
    expect(sectionText(document, 'office-location')).toMatch(/8491 NW 39th/);
    expect(sectionText(document, 'orders')).toMatch(/ordered|Order/);
    expect(sectionText(document, 'pleadings')).toMatch(/motion to compel/i);
    expect(sectionText(document, 'testimony-inconsistencies')).toMatch(
      /testified about 300 times/,
    );
  });

  it('never prints the generic empty line; empty sections use professional language', () => {
    const everything = document.sections
      .flatMap((section) => section.blocks.map((block) => block.text))
      .join('\n');
    expect(everything).not.toContain(GENERIC);
    expect(everything).not.toContain('Search coverage');
    expect(everything).not.toContain('[Court record]');
    expect(everything).not.toMatch(/targeted web search/);
    expect(everything).not.toMatch(/A search cannot prove that nothing exists/);
    for (const id of ['grants', 'patents', 'criminal', 'board-actions']) {
      expect(sectionText(document, id)).toMatch(
        /included this topic|was not searched|not implemented|returned no matching record|dedicated search for this topic ran/,
      );
      expect(sectionText(document, id)).not.toMatch(/did not establish/);
    }
  });

  it('files IME language from the practice site', () => {
    expect(sectionText(document, 'ime')).toMatch(
      /independent medical|forensic neuropsychological/i,
    );
    expect(sectionText(document, 'ime')).not.toContain(GENERIC);
  });

  it('reports a blocked registry as not read, not as absent', () => {
    const registry = dossier.records.find((record) => record.url === SUNBIZ);
    expect(registry?.read).toBe('restricted');
    expect(sectionText(document, 'web-research')).toMatch(
      /could not be read|bot-protection|403/,
    );
  });

  it('does not print search-request counts in the client report', () => {
    const text = sectionText(document, 'web-research');
    expect(text).not.toMatch(/\d+ of \d+ planned/);
    expect(text).not.toMatch(/search request\(s\) were sent/);
    expect(text).toMatch(/different person|other person|Jason B\. Demery/);
  });
});
