import {
  EXPERT_RESEARCH_CATALOG,
  articleTitle,
  authorPositionIn,
  describePosition,
  parsePersonName,
  researchCoverageFor,
  sameTitle,
  type ExpertEvidenceItem,
  type ExpertIdentityResolution,
  type ResearchCoverage,
  type ResearchOutcome,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiAnalysisDocument } from '../investigation/analysis/ewi-analysis.types';
import {
  NO_RECORDS_LINE,
  collectedLine,
  presentableSummaryLines,
} from '../investigation/analysis/summary-lines';
import type { CvCheck, CvComparison } from '../cv/cv.types';
import { CV_LABEL_TEXT, cvComparisonCountSummary } from '../cv/cv-comparison';
import {
  evidenceStatusLine,
  findingLabel,
  findingStatement,
  sourceIndexStatus,
  withoutSingleAccount,
  withoutUnverifiedSentences,
} from './report-wording';
import type { InconsistencyLabel } from '../research/verification-labels';
import type { LegalMatter, LegalResearchDossier } from '../research/legal';
import {
  CHALLENGE_OUTCOME_LABEL,
  CHALLENGE_STANDARD_LABEL,
  buildLegalResearchDossier,
  isLegalItem,
} from '../research/legal';
import type {
  OnlinePresenceDossier,
  PresenceRecord,
} from '../research/online-presence';
import {
  buildOnlinePresenceDossier,
  isPresenceItem,
  locationRequiresVerification,
} from '../research/online-presence';
import type {
  ProfessionalBackgroundDossier,
  ProfessionalRecord,
} from '../research/professional-background';
import {
  buildProfessionalBackgroundDossier,
  hasEstimatedPercentage,
  isProfessionalItem,
} from '../research/professional-background';
import type {
  RoutedFinding,
  RoutedSectionId,
  WebCandidate,
  WebRecord,
  WebResearchDossier,
  WebVerification,
} from '@integrations/web-research';
import {
  coverageLine,
  displayStructuredCoverage,
  findingsCoverageNote,
  isRoutedSection,
  isWebCoverageSummary,
  publicSearchNote,
  routeWebFindings,
  sectionVerification,
} from '@integrations/web-research';
import type {
  ReportBlock,
  ReportDocumentModel,
  ReportIconName,
  ReportSectionModel,
} from '@platform/report/report-document';
import {
  EWI_REPORT_DISCLAIMER,
  EWI_REPORT_TEMPLATE_ID,
  EWI_REPORT_TEMPLATE_VERSION,
} from './ewi-report.version';

const EMPTY =
  'Nothing in this section was confirmed from the sources and pages retrieved. This is not proof that nothing exists; see the source coverage list for what was and was not reachable.';

export interface EwiReportSectionSpec {
  id: string;
  title: string;
  number: number;
  /** Header icon of the section's card. */
  icon?: ReportIconName;
  /** Sections 1–5 are shown on the cover. */
  placement?: ReportSectionModel['placement'];
}

/**
 * Final EWI report outline (attorney review). Sections 1–5 are on the PDF's
 * cover; the rest are cards, in this order.
 * Content is built only from collected evidence and dossiers.
 */
export const EWI_REPORT_SECTIONS: EwiReportSectionSpec[] = [
  {
    id: 'expert-name',
    number: 1,
    title: '1. Expert Name',
    placement: 'cover-fact',
  },
  {
    id: 'city',
    number: 2,
    title: '2. City',
    placement: 'cover-fact',
  },
  {
    id: 'specialty',
    number: 3,
    title: '3. Specialty',
    placement: 'cover-fact',
  },
  {
    id: 'investigation-date',
    number: 4,
    title: '4. Investigation Date',
    placement: 'cover-fact',
  },
  {
    id: 'summary',
    number: 5,
    title: '5. Executive Summary',
    placement: 'cover-summary',
  },
  {
    id: 'background',
    number: 6,
    title: '6. Expert Background',
    icon: 'user',
  },
  {
    id: 'inconsistencies',
    number: 7,
    title: '7. Inconsistencies in Background',
    icon: 'alert-triangle',
  },
  {
    id: 'cv-comparison',
    number: 8,
    title: '8. CV Comparison',
    icon: 'git-compare',
  },
  {
    id: 'education',
    number: 9,
    title: '9. Education and Degrees',
    icon: 'graduation-cap',
  },
  {
    id: 'university-accreditation',
    number: 10,
    title: '10. University Accreditation',
    icon: 'school',
  },
  {
    id: 'licenses',
    number: 11,
    title: '11. Licenses',
    icon: 'badge-check',
  },
  {
    id: 'board-actions',
    number: 12,
    title: '12. State Licensing/Board Actions',
    icon: 'shield-alert',
  },
  {
    id: 'board-certifications',
    number: 13,
    title: '13. Board Certifications',
    icon: 'award',
  },
  {
    id: 'certification-orgs',
    number: 14,
    title: '14. Certification Organizations',
    icon: 'building',
  },
  {
    id: 'memberships',
    number: 15,
    title: '15. Memberships',
    icon: 'users',
  },
  {
    id: 'publications',
    number: 16,
    title: '16. Publications',
    icon: 'book-open',
  },
  {
    id: 'grants',
    number: 17,
    title: '17. Grants',
    icon: 'coins',
  },
  {
    id: 'patents',
    number: 18,
    title: '18. Patents',
    icon: 'lightbulb',
  },
  {
    id: 'awards-military',
    number: 19,
    title: '19. Awards/Military Claims',
    icon: 'medal',
  },
  {
    id: 'websites',
    number: 20,
    title: '20. Expert Websites',
    icon: 'globe',
  },
  {
    id: 'ime',
    number: 21,
    title: '21. IME/Advertising',
    icon: 'megaphone',
  },
  {
    id: 'directories',
    number: 22,
    title: '22. Expert Directories',
    icon: 'book-user',
  },
  {
    id: 'orders',
    number: 23,
    title: '23. Orders',
    icon: 'scroll-text',
  },
  {
    id: 'pleadings',
    number: 24,
    title: '24. Pleadings/Motions',
    icon: 'file-text',
  },
  {
    id: 'depositions',
    number: 25,
    title: '25. Depositions',
    icon: 'mic',
  },
  {
    id: 'testimony-inconsistencies',
    number: 26,
    title: '26. Testimony Inconsistencies',
    icon: 'message-square-warning',
  },
  {
    id: 'admissibility-challenges',
    number: 27,
    title: '27. Daubert/Frye Challenges',
    icon: 'scale',
  },
  {
    id: 'income-bias',
    number: 28,
    title: '28. Income/Bias',
    icon: 'banknote',
  },
  {
    id: 'lawsuits',
    number: 29,
    title: '29. Lawsuits/Malpractice',
    icon: 'landmark',
  },
  {
    id: 'criminal',
    number: 30,
    title: '30. Criminal Records',
    icon: 'fingerprint',
  },
  {
    id: 'social',
    number: 31,
    title: '31. Social Media',
    icon: 'share',
  },
  {
    id: 'videos',
    number: 32,
    title: '32. Videos/Transcripts',
    icon: 'video',
  },
  {
    id: 'news',
    number: 33,
    title: '33. News/Blogs',
    icon: 'newspaper',
  },
  {
    id: 'university-rules',
    number: 34,
    title: '34. University Rules',
    icon: 'clipboard-list',
  },
  {
    id: 'corporate',
    number: 35,
    title: '35. Corporate Affiliations',
    icon: 'briefcase',
  },
  {
    id: 'patient-reviews',
    number: 36,
    title: '36. Patient Reviews',
    icon: 'star',
  },
  {
    id: 'office-location',
    number: 37,
    title: '37. Office/Location Findings',
    icon: 'map-pin',
  },
  {
    id: 'misc',
    number: 38,
    title: '38. Miscellaneous Findings',
    icon: 'layers',
  },
  {
    id: 'web-research',
    number: 39,
    title: '39. Other People with This Name',
    icon: 'globe',
  },
  {
    id: 'overall-findings',
    number: 40,
    title: '40. Overall Research Findings',
    icon: 'list-checks',
  },
  {
    id: 'source-index',
    number: 41,
    title: '41. Source Index',
    icon: 'link',
  },
];

type ClaimTracker = {
  claimed: Set<number>;
  evidence: ExpertEvidenceItem[];
};

export function buildEwiReportDocument(input: {
  expertName: string;
  city: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  generatedAt: string;
  summary?: string;
  analysis?: EwiAnalysisDocument;
  legalResearch?: LegalResearchDossier;
  onlinePresence?: OnlinePresenceDossier;
  professionalBackground?: ProfessionalBackgroundDossier;
  identity?: ExpertIdentityResolution | null;
  cvCheck?: CvCheck | null;
  /** Free text the attorney added to the intake form. */
  additionalContext?: string | null;
  /** Global web research: candidates, pages, coverage and limits. */
  webResearch?: WebResearchDossier | null;
  /** What each catalog source did in this investigation (checked, not connected, failed). */
  sourceStatuses?: ReportSourceStatus[];
  /** Shown when stored questions were rebuilt from current evidence. */
  questionsNote?: string;
}): ReportDocumentModel {
  const routedWeb = routeWebFindings(input.webResearch);
  const tracker: ClaimTracker = {
    claimed: new Set<number>(),
    evidence: input.evidence,
  };
  const legalDossier =
    input.legalResearch ??
    buildLegalResearchDossier({ evidence: input.evidence });
  const presenceDossier =
    input.onlinePresence ??
    buildOnlinePresenceDossier({ evidence: input.evidence });
  const professionalDossier =
    input.professionalBackground ??
    buildProfessionalBackgroundDossier({ evidence: input.evidence });

  const built: ReportSectionModel[] = EWI_REPORT_SECTIONS.map((spec) => {
    switch (spec.id) {
      case 'expert-name':
        return simpleFieldSection(spec, input.expertName);
      case 'city':
        return simpleFieldSection(
          spec,
          input.city.trim() || 'Not provided (the search ran without a city)',
        );
      case 'specialty':
        return simpleFieldSection(spec, input.specialty);
      case 'investigation-date':
        return simpleFieldSection(
          spec,
          formatInvestigationDate(input.generatedAt),
        );
      case 'summary':
        return summarySection(spec, {
          ...input,
          webLines: webSummaryLines(routedWeb, input.webResearch ?? null).slice(
            0,
            8,
          ),
        });
      case 'background':
        return backgroundSection(spec, tracker, input.identity ?? null);
      case 'inconsistencies':
        return inconsistenciesSection(spec, input);
      case 'cv-comparison':
        return cvComparisonSection(spec, input, tracker);
      case 'education':
        return withCvStatements(
          evidenceSection(spec, tracker, {
            categories: ['education'],
          }),
          input.cvCheck,
          ['education', 'training'],
        );
      case 'university-accreditation':
        return evidenceSection(spec, tracker, {
          categories: ['accreditation'],
          providers: ['university_accreditation'],
          titleHints: ['accredit'],
        });
      case 'licenses':
        return licensesSection(spec, tracker, input.identity ?? null);
      case 'board-actions':
        return boardActionsSection(spec, tracker);
      case 'board-certifications':
        return withCvStatements(
          evidenceSection(spec, tracker, {
            categories: ['board', 'board_certification', 'certification'],
            excludeHints: ['organization'],
          }),
          input.cvCheck,
          ['board_certification'],
        );
      case 'certification-orgs':
        return evidenceSection(spec, tracker, {
          categories: ['certification_organization'],
          titleHints: ['certification organization', 'abms', 'board of'],
        });
      case 'memberships':
        return withCvStatements(
          membershipsSection(spec, professionalDossier, tracker),
          input.cvCheck,
          ['membership'],
        );
      case 'publications':
        return publicationsSection(
          spec,
          tracker,
          input.expertName,
          input.cvCheck,
        );
      case 'grants':
        return professionalGroupSection(
          spec,
          uniqueProfessionalRecords(professionalDossier.grants),
          professionalDossier,
          tracker,
        );
      case 'patents':
        return professionalGroupSection(
          spec,
          uniqueProfessionalRecords(professionalDossier.patentsAndTrademarks),
          professionalDossier,
          tracker,
        );
      case 'awards-military':
        return professionalGroupSection(
          spec,
          uniqueProfessionalRecords([
            ...professionalDossier.awardsAndMedals,
            ...professionalDossier.militaryClaims,
          ]),
          professionalDossier,
          tracker,
        );
      case 'websites':
        return presenceGroupSection(
          spec,
          [...presenceDossier.websites, ...presenceDossier.otherPublicSites],
          presenceDossier,
          tracker,
        );
      case 'ime':
        return presenceGroupSection(
          spec,
          presenceDossier.ime,
          presenceDossier,
          tracker,
        );
      case 'directories':
        return presenceGroupSection(
          spec,
          presenceDossier.directories,
          presenceDossier,
          tracker,
        );
      case 'orders':
        return ordersSection(spec, legalDossier, tracker);
      case 'pleadings':
        return pleadingsSection(spec, legalDossier, tracker);
      case 'depositions':
        return depositionsSection(spec, legalDossier, tracker);
      case 'testimony-inconsistencies':
        return testimonyInconsistenciesSection(spec, legalDossier, tracker);
      case 'admissibility-challenges':
        return admissibilitySection(spec, legalDossier, tracker);
      case 'income-bias':
        return incomeBiasSection(spec, professionalDossier, tracker);
      case 'lawsuits':
        return legalMattersSection(
          spec,
          legalDossier,
          tracker,
          (matter) =>
            matter.challenge === null &&
            (matter.documentType === 'malpractice' ||
              (matter.documentType === 'case' && claimAgainstExpert(matter))),
        );
      case 'criminal':
        return legalMattersSection(
          spec,
          legalDossier,
          tracker,
          (matter) => matter.documentType === 'criminal_record',
        );
      case 'social':
        return presenceGroupSection(
          spec,
          presenceDossier.social,
          presenceDossier,
          tracker,
        );
      case 'videos':
        return presenceGroupSection(
          spec,
          presenceDossier.videos,
          presenceDossier,
          tracker,
        );
      case 'news':
        return presenceGroupSection(
          spec,
          presenceDossier.newsAndBlogs,
          presenceDossier,
          tracker,
        );
      case 'university-rules':
        return evidenceSection(spec, tracker, {
          categories: ['university', 'university_rules'],
          providers: ['university'],
          titleHints: ['rule', 'policy', 'bylaw'],
        });
      case 'corporate':
        return professionalGroupSection(
          spec,
          uniqueProfessionalRecords(professionalDossier.corporateAffiliations),
          professionalDossier,
          tracker,
        );
      case 'patient-reviews':
        return presenceGroupSection(
          spec,
          presenceDossier.patientReviews,
          presenceDossier,
          tracker,
        );
      case 'office-location':
        return withNpiLocation(
          presenceGroupSection(
            spec,
            presenceDossier.locations,
            presenceDossier,
            tracker,
          ),
          input.evidence,
        );
      case 'misc':
        return miscellaneousSection(spec, tracker);
      case 'web-research':
        return webResearchSection(
          spec,
          input.webResearch ?? null,
          input.additionalContext ?? null,
        );
      case 'overall-findings':
        return overallFindingsSection(spec, {
          ...input,
          webLines: webSummaryLines(routedWeb, input.webResearch ?? null),
        });
      case 'source-index':
        return sourceIndexSection(spec, input.evidence);
      default:
        return {
          id: spec.id,
          title: spec.title,
          blocks: [{ text: EMPTY, style: 'note' }],
        };
    }
  });
  const sections = built.map((section, index) => {
    const { icon, placement } = EWI_REPORT_SECTIONS[index];
    return {
      ...withWebFindings(
        section,
        routedWeb,
        input.webResearch ?? null,
        input.sourceStatuses ?? [],
        input.expertName,
      ),
      ...(icon ? { icon } : {}),
      ...(placement ? { placement } : {}),
    };
  });

  const safeName = input.expertName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    product: 'ewi',
    templateId: EWI_REPORT_TEMPLATE_ID,
    templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    title: 'Expert Witness Investigation Report',
    subtitle: [input.expertName, input.city.trim(), input.specialty]
      .filter(Boolean)
      .join(' — '),
    headerLabel: 'Expert Witness Investigation',
    fileName: `ewi-${safeName || 'expert'}-report.pdf`,
    generatedAt: input.generatedAt,
    mimeType: 'application/pdf',
    format: 'pdf',
    includeTableOfContents: true,
    // Source and category ids appear in source lines; Word would mark
    // them as misspelled.
    noProofTerms: [
      ...EXPERT_RESEARCH_CATALOG.flatMap((provider) => [
        provider.id,
        provider.category,
      ]),
      ...input.evidence.flatMap((item) => [item.sourceId, item.category]),
    ],
    highlights: [
      countLabel(
        reportableEvidence(input.evidence).length,
        'collected item',
        'collected items',
      ),
      countLabel(
        confirmedInconsistencyCount(input),
        'inconsistency',
        'inconsistencies',
      ),
      'Cross-examination questions omitted',
    ],
    metadata: {
      expertName: input.expertName,
      city: input.city,
      specialty: input.specialty,
      investigationDate: formatInvestigationDate(input.generatedAt),
      reportVersion: EWI_REPORT_TEMPLATE_VERSION,
      templateId: EWI_REPORT_TEMPLATE_ID,
      product: 'ewi',
      disclaimer: EWI_REPORT_DISCLAIMER,
      ...(input.webResearch?.portrait
        ? {
            coverImage: {
              dataUrl: input.webResearch.portrait.dataUrl,
              sourceUrl: input.webResearch.portrait.sourceUrl,
            },
          }
        : {}),
    },
    sections,
  };
}

/** The practice address the NPI Registry lists, as its own entry in the location section. */
function withNpiLocation(
  section: ReportSectionModel,
  evidence: ExpertEvidenceItem[],
): ReportSectionModel {
  const blocks = section.blocks.filter((block) => block.text !== EMPTY);
  for (const item of evidence) {
    if (item.sourceId !== 'npi_registry') continue;
    const location = item.raw?.practiceLocation;
    if (!location || typeof location !== 'object') continue;
    const fields = location as Record<string, unknown>;
    const address = ['line', 'city', 'state', 'postalCode', 'zip']
      .map((key) => fields[key])
      .filter(
        (value): value is string => typeof value === 'string' && value !== '',
      )
      .join(', ');
    if (!address) continue;
    if (blocks.some((block) => block.text.includes(address))) continue;
    blocks.push({
      text: 'Practice location listed in the NPI Registry',
      style: 'subheading',
    });
    blocks.push({ text: address, noProof: true });
    blocks.push({
      text: `Listed by the registry for ${item.title}; the registry shows the address the provider reported, not a visit or a lease.`,
      style: 'citation',
    });
    if (item.url)
      blocks.push({ text: item.url, link: item.url, style: 'citation' });
  }
  return { ...section, blocks };
}

export interface ReportSourceStatus {
  sourceId: string;
  status: string;
  outcome?: ResearchOutcome | null;
  coverage?: ResearchCoverage;
  message?: string | null;
  itemCount?: number;
  checked?: boolean;
  retrievedAt?: string;
}

/** Catalog sources that answer each routed section, for the coverage line. */
const SECTION_SOURCES: Partial<Record<RoutedSectionId, string[]>> = {
  education: ['education_verification'],
  'university-accreditation': ['university_accreditation'],
  licenses: ['npi_registry', 'state_license'],
  'board-actions': ['state_discipline'],
  'board-certifications': ['board_certification'],
  'certification-orgs': ['certification_organization'],
  memberships: ['memberships', 'professional_organizations'],
  publications: [
    'pubmed',
    'openalex',
    'crossref',
    'orcid',
    'author_verification',
  ],
  grants: ['grants', 'grant_results'],
  patents: ['patents', 'trademarks'],
  'awards-military': ['awards', 'military_claims'],
  orders: ['orders', 'courtlistener', 'justia', 'state_court_records'],
  pleadings: [
    'motions',
    'pleadings',
    'courtlistener',
    'justia',
    'state_court_records',
  ],
  depositions: ['depositions'],
  'testimony-inconsistencies': ['expert_testimony'],
  lawsuits: [
    'courtlistener',
    'justia',
    'lexisnexis',
    'malpractice_records',
    'state_court_records',
  ],
  criminal: ['criminal_records'],
  corporate: ['corporate_affiliations'],
  'patient-reviews': ['patient_reviews'],
  'office-location': ['google_maps'],
  social: ['social'],
  news: ['news', 'blogs'],
  'admissibility-challenges': [
    'courtlistener',
    'justia',
    'state_court_records',
    'expert_testimony',
  ],
  websites: ['expert_website'],
  directories: [
    'expert_directory',
    'dri',
    'seak',
    'alm_law',
    'jurispro',
    'expertlaw',
    'expertpages',
    'expertwitness_com',
    'other_expert_directories',
  ],
  ime: ['ime_websites', 'ime_advertising', 'advertising'],
  videos: ['youtube', 'presentations'],
};

function sourceName(id: string): string {
  return EXPERT_RESEARCH_CATALOG.find((p) => p.id === id)?.name ?? id;
}

const COVERAGE_PHRASE: Record<ResearchCoverage, string> = {
  searched_with_results: 'was searched and returned records',
  searched_no_results:
    'was searched and returned no matching record. That is not proof that none exist',
  not_configured: 'was not searched (API key or credential not configured)',
  not_implemented: 'is not implemented in this investigation',
  blocked_or_access_denied:
    'could not be accessed (login, subscription, bot protection, or similar restriction)',
  failed: 'failed technically and was not treated as an empty search',
  skipped: 'was skipped',
  pending: 'has not been searched yet',
};

/** Which of the section's registry sources were checked and which were not reachable. */
function structuredCoverage(
  sectionId: string,
  statuses: ReportSourceStatus[],
): string[] {
  if (!isRoutedSection(sectionId)) return [];
  const ids = SECTION_SOURCES[sectionId] ?? [];
  if (ids.length === 0 || statuses.length === 0) return [];
  const groups = new Map<ResearchCoverage, string[]>();
  for (const id of ids) {
    const status = statuses.find((s) => s.sourceId === id);
    if (!status) continue;
    const coverage =
      status.coverage ??
      researchCoverageFor({
        status: status.status,
        outcome: status.outcome,
        message: status.message,
        itemCount: status.itemCount,
      });
    const list = groups.get(coverage) ?? [];
    list.push(sourceName(id));
    groups.set(coverage, list);
  }
  const order: ResearchCoverage[] = [
    'searched_with_results',
    'searched_no_results',
    'not_configured',
    'not_implemented',
    'blocked_or_access_denied',
    'failed',
    'skipped',
    'pending',
  ];
  const parts: string[] = [];
  for (const coverage of order) {
    const names = groups.get(coverage);
    if (!names || names.length === 0) continue;
    if (coverage === 'searched_with_results') {
      parts.push(
        `${joinNames(names)} returned records in other sections; that does not mean this section was comprehensively searched.`,
      );
      continue;
    }
    parts.push(`${joinNames(names)} ${COVERAGE_PHRASE[coverage]}.`);
  }
  return parts;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function webFindingBlocks(finding: RoutedFinding): ReportBlock[] {
  const blocks: ReportBlock[] = [
    { text: finding.title, style: 'subheading', noProof: true },
  ];
  const quote = finding.quote?.trim() ?? '';
  if (
    finding.statement &&
    finding.statement !== quote &&
    !(quote && finding.statement.includes(quote))
  ) {
    blocks.push({ text: finding.statement, noProof: true });
  }
  if (quote && quote !== finding.title) {
    blocks.push({ text: `“${quote}”`, noProof: true });
  }
  if (finding.sectionId === 'patient-reviews') {
    blocks.push({
      text: finding.rating
        ? `Rating shown on the retrieved page: ${finding.rating}.`
        : 'Rating not shown on the retrieved page.',
      style: 'note',
      noProof: true,
    });
  }
  const published = webDate(finding.publishedAt);
  const fromNewsIndex = (finding.searchProviders ?? []).every((id) =>
    ['google_news_rss', 'gdelt'].includes(id),
  );
  const notes = [
    finding.from === 'snippet'
      ? finding.kind === 'news' || finding.kind === 'blog' || fromNewsIndex
        ? 'RSS/GDELT listing; article text was not read.'
        : finding.kind === 'social'
          ? 'Profile URL found; the page was not read.'
          : 'Taken from a search result; the page itself was not read.'
      : finding.read === 'read'
        ? finding.kind === 'news' || finding.kind === 'blog'
          ? 'Article text was read.'
          : finding.kind === 'social'
            ? 'Page was read.'
            : null
        : null,
    finding.matchLevel === 'possible'
      ? 'The page only partly agrees with the subject, so this is a possible match.'
      : null,
    finding.basisLabel && finding.basis !== 'record'
      ? finding.basisLabel
      : null,
    published ? `Published ${published}.` : null,
  ].filter(Boolean);
  if (notes.length > 0) {
    blocks.push({ text: notes.join(' '), style: 'citation' });
  }
  blocks.push({ text: finding.url, link: finding.url, style: 'citation' });
  return blocks;
}

function verificationBlocks(verification: WebVerification): ReportBlock[] {
  if (verification.status === 'confirmed' && verification.confirmedBy) {
    const blocks: ReportBlock[] = [
      {
        text: `Confirmed on ${verification.confirmedBy.name}.`,
        noProof: true,
      },
    ];
    if (verification.confirmedBy.quote) {
      blocks.push({
        text: `“${verification.confirmedBy.quote}”`,
        noProof: true,
      });
    }
    blocks.push({
      text: verification.confirmedBy.url,
      link: verification.confirmedBy.url,
      style: 'citation',
    });
    return blocks;
  }
  const who =
    verification.status === 'not_checked'
      ? 'The issuing body’s own site was not searched in this investigation, so the claim is reported as made and not confirmed at the source.'
      : verification.note;
  return [{ text: who, style: 'note' }];
}

/**
 * Adds what the web run found for this section and replaces the generic
 * "nothing confirmed" line with what was searched and what limited it.
 */
function withWebFindings(
  section: ReportSectionModel,
  routed: Map<RoutedSectionId, RoutedFinding[]>,
  dossier: WebResearchDossier | null,
  statuses: ReportSourceStatus[],
  expertName?: string,
): ReportSectionModel {
  if (!isRoutedSection(section.id)) return section;
  const own = section.blocks.filter((block) => block.text !== EMPTY);
  const existing = own
    .map((block) => `${block.text}\n${block.link ?? ''}`)
    .join('\n')
    .toLowerCase();
  const seenFinding = new Set<string>();
  const findings = (routed.get(section.id) ?? []).filter((finding) => {
    if (existing.includes(finding.url.toLowerCase())) return false;
    const key = `${finding.url}|${(finding.quote ?? finding.statement).toLowerCase().slice(0, 160)}`;
    if (seenFinding.has(key)) return false;
    seenFinding.add(key);
    return true;
  });
  const blocks: ReportBlock[] = [...own];
  for (const finding of findings) blocks.push(...webFindingBlocks(finding));
  const verification = sectionVerification(dossier, section.id);
  if (verification && (findings.length > 0 || own.length > 0)) {
    blocks.push(...verificationBlocks(verification));
  }
  const coverage = structuredCoverage(section.id, statuses);
  const hasFindingBlocks =
    findings.length > 0 ||
    own.some((block) => block.style !== 'note' && block.style !== 'citation');
  if (!hasFindingBlocks) {
    blocks.push({
      text: coverageLine(dossier, section.id, coverage, expertName),
      style: 'note',
    });
  } else {
    const fromGeneral = findingsCoverageNote(dossier, section.id);
    if (fromGeneral) blocks.push({ text: fromGeneral, style: 'note' });
    const limit = publicSearchNote(dossier, section.id);
    if (limit) blocks.push({ text: limit, style: 'note' });
    for (const line of displayStructuredCoverage(
      dossier,
      section.id,
      coverage,
    )) {
      if (/returned records in other sections/i.test(line)) continue;
      blocks.push({ text: line, style: 'note' });
    }
  }
  return { ...section, blocks };
}

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function confirmedInconsistencyCount(input: {
  discrepancies: ExpertDiscrepancy[];
  analysis?: EwiAnalysisDocument;
  cvCheck?: CvCheck | null;
}): number {
  const cvAlreadyCounted = input.discrepancies.some((item) =>
    item.id.startsWith('cv-check-'),
  );
  const fromCv = cvAlreadyCounted
    ? 0
    : (input.cvCheck?.comparisons.filter((row) => row.label === 'conflicting')
        .length ?? 0);
  return (
    input.discrepancies.length +
    (input.analysis?.conflicts.length ?? 0) +
    fromCv
  );
}

/** Findings about the expert. The web coverage summary is an audit line. */
function reportableEvidence(
  evidence: ExpertEvidenceItem[],
): ExpertEvidenceItem[] {
  return evidence.filter((item) => !isWebCoverageSummary(item));
}

function formatInvestigationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

function simpleFieldSection(
  spec: EwiReportSectionSpec,
  text: string,
): ReportSectionModel {
  return {
    id: spec.id,
    title: spec.title,
    blocks: [{ text }],
  };
}

function backgroundSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
  identity: ExpertIdentityResolution | null,
): ReportSectionModel {
  // NPI Registry items are claimed by category: its license list belongs in
  // the Licenses section.
  const items = claimEvidence(tracker, {
    categories: ['identity', 'profile', 'specialty', 'location'],
    providers: ['web_search', 'orcid'],
    excludeHints: ['web research coverage'],
  }).filter((item) => {
    if (item.sourceId !== 'npi_registry') return true;
    if (!identity) return true;
    return identity.status === 'confirmed';
  });
  const blocks = identityBlocks(identity);
  if (items.length > 0) {
    blocks.push(...items.flatMap(findingBlocks));
  } else if (blocks.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
  }
  return { id: spec.id, title: spec.title, blocks };
}

const IDENTITY_STATUS_TEXT: Record<ExpertIdentityResolution['status'], string> =
  {
    confirmed: 'Identity confirmed in the NPI Registry',
    ambiguous: 'Identity not confirmed',
    not_found: 'No matching NPI Registry record',
    npi_mismatch: 'The supplied NPI does not match the expert',
    unavailable: 'NPI Registry not checked',
  };

function identityHeading(identity: ExpertIdentityResolution): string {
  if (identity.status !== 'ambiguous') {
    return IDENTITY_STATUS_TEXT[identity.status];
  }
  const count = identity.candidates.length;
  if (count === 1) return 'Identity not confirmed — one possible NPI record';
  if (count > 1) {
    return `Identity not confirmed — ${count} possible NPI records`;
  }
  return 'Identity not confirmed — possible NPI records';
}

function identityBlocks(
  identity: ExpertIdentityResolution | null,
): ReportBlock[] {
  if (!identity) return [];
  const blocks: ReportBlock[] = [
    { text: identityHeading(identity), style: 'subheading' },
    { text: identity.note },
  ];
  const record = identity.identity;
  if (record) {
    blocks.push({
      text: [
        `NPI: ${record.npi}`,
        `Name: ${record.name}`,
        record.taxonomy ? `Primary taxonomy: ${record.taxonomy}` : null,
        record.city
          ? `Practice location: ${record.city}${record.state ? `, ${record.state}` : ''}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (identity.basis.length > 0) {
    blocks.push({
      text: `Matched on: ${identity.basis.join(', ')}.`,
      style: 'citation',
    });
  }
  for (const note of identity.notes) {
    blocks.push({ text: note, style: 'note' });
  }
  for (const candidate of identity.candidates) {
    blocks.push({
      text: `Possible record: NPI ${candidate.npi} — ${candidate.name}${candidate.taxonomy ? `, ${candidate.taxonomy}` : ''}${candidate.city ? `, registry city ${candidate.city}${candidate.state ? `, ${candidate.state}` : ''}` : ''}. This is not a confirmed identity.`,
    });
  }
  if (record?.url) {
    blocks.push({ text: record.url, link: record.url, style: 'citation' });
  }
  if (identity.simulated) {
    blocks.push({
      text: 'Development fixture. Not a real NPI Registry record.',
      style: 'note',
    });
  }
  return blocks;
}

function admissibilitySection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  const records = dossier.challenges;
  markLegalClaimed(
    tracker,
    records.map((record) => record.matter),
  );
  const blocks: ReportBlock[] = [
    {
      text: 'Court opinions that contain the expert’s full name, a specialty term, and Daubert, Frye, Rule 702, or motion-to-exclude language. An outcome is stated only when the court’s own words, quoted exactly from the collected opinion text, say how the court ruled on this expert. “Not determined” means the collected text did not say; read the opinion.',
      style: 'note',
    },
  ];
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = CHALLENGE_OUTCOME_LABEL[record.challenge.outcome];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  blocks.push({
    text: `${records.length} opinion(s): ${[...counts.entries()]
      .map(([label, count]) => `${label} ${count}`)
      .join('; ')}.`,
  });
  for (const record of records) {
    const matter = record.matter;
    const challenge = record.challenge;
    blocks.push({
      text: `${matter.caseName ?? matter.title}${record.sortDate ? ` (${record.sortDate})` : ''}`,
      style: 'subheading',
    });
    const fields = [
      matter.court ? `Court: ${matter.court}` : null,
      matter.citation ? `Citation: ${matter.citation}` : null,
      matter.caseNumber ? `Docket: ${matter.caseNumber}` : null,
      `Standard: ${CHALLENGE_STANDARD_LABEL[challenge.standard]}`,
      `Outcome: ${CHALLENGE_OUTCOME_LABEL[challenge.outcome]}`,
    ].filter((line): line is string => Boolean(line));
    for (const line of fields) blocks.push({ text: line });
    blocks.push({
      text: challenge.note,
      style: challenge.basis === 'court_text' ? undefined : 'note',
    });
    if (challenge.basis !== 'court_text') {
      for (const excerpt of challenge.excerpts.slice(0, 2)) {
        blocks.push({ text: `Excerpt: “${excerpt}”`, style: 'citation' });
      }
    }
    blocks.push({
      text: `Evidence reference: ${matter.evidenceReference}`,
      style: 'citation',
    });
    if (matter.sourceUrl) {
      blocks.push({
        text: matter.sourceUrl,
        link: matter.sourceUrl,
        style: 'citation',
      });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

/**
 * The summary on the cover. The subject is in the cover details, the counts
 * are its badges, and the disclaimer has its own card, so none repeat here.
 */
function summarySection(
  spec: EwiReportSectionSpec,
  input: {
    summary?: string;
    analysis?: EwiAnalysisDocument;
    evidence: ExpertEvidenceItem[];
    webLines?: string[];
    identity?: ExpertIdentityResolution | null;
    cvCheck?: CvCheck | null;
    discrepancies: ExpertDiscrepancy[];
  },
): ReportSectionModel {
  const text =
    input.summary?.trim() || input.analysis?.summary || NO_RECORDS_LINE;
  const findings = reportableEvidence(input.evidence).length;
  const collectedCount =
    /^\d+ item\(s\) were collected from the sources searched\.$/;
  // A line saying an item was not verified is left out here; the item is
  // listed under Overall Research Findings.
  const blocks: ReportBlock[] = presentableSummaryLines(
    text,
    input.analysis?.missing,
  )
    .map(withoutUnverifiedSentences)
    .map((line) =>
      collectedCount.test(line)
        ? findings
          ? collectedLine(findings)
          : ''
        : line,
    )
    .filter(Boolean)
    .map((line) => ({ text: line }));
  if (input.identity && input.identity.status !== 'confirmed') {
    blocks.unshift({
      text: `${identityHeading(input.identity)}. ${input.identity.note}`,
      style: 'note',
    });
  }
  if (input.cvCheck) {
    blocks.push({
      text: cvComparisonCountSummary(input.cvCheck),
      style: 'note',
    });
  }
  const conflictCount = confirmedInconsistencyCount(input);
  blocks.push({
    text:
      conflictCount === 0
        ? `${findings} collected item(s). No confirmed inconsistency was identified. Unchecked CV claims and catalog misses are listed under CV Comparison; they are not counted as inconsistencies.`
        : `${findings} collected item(s). ${conflictCount} confirmed inconsistency(ies) are listed under Inconsistencies in Background and CV Comparison.`,
    style: 'note',
  });
  const webLines = input.webLines ?? [];
  const hasSubstance =
    webLines.length > 0 ||
    Boolean(input.cvCheck) ||
    Boolean(input.identity) ||
    findings > 0;
  // "No information was confirmed" would contradict findings below it.
  const own = hasSubstance
    ? blocks.filter((block) => block.text !== NO_RECORDS_LINE)
    : blocks;
  blocks.splice(0, blocks.length, ...own);
  if (blocks.length === 0 && webLines.length === 0) {
    blocks.push({
      text: findings ? collectedLine(findings) : NO_RECORDS_LINE,
    });
  }
  if (webLines.length > 0) {
    blocks.push({
      text: 'Selected findings (each is sourced in its section):',
      style: 'note',
    });
  }
  for (const line of webLines) {
    blocks.push({ text: line, noProof: true });
  }
  return { id: spec.id, title: spec.title, blocks };
}

const WEB_SUMMARY_ORDER: RoutedSectionId[] = [
  'board-certifications',
  'certification-orgs',
  'education',
  'licenses',
  'board-actions',
  'memberships',
  'publications',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'criminal',
  'lawsuits',
  'corporate',
  'office-location',
  'ime',
  'grants',
  'patents',
  'awards-military',
  'background',
];

function plainTitle(sectionId: string): string {
  const spec = EWI_REPORT_SECTIONS.find((s) => s.id === sectionId);
  return (spec?.title ?? sectionId).replace(/^\d+\.\s*/, '');
}

const WEB_BASIS_RANK: Record<RoutedFinding['basis'], number> = {
  primary_source: 0,
  subject_stated: 1,
  third_party: 2,
  allegation: 3,
  record: 4,
};

/** One line per section the web research filled, with who stands behind it. */
function webSummaryLines(
  routed: Map<RoutedSectionId, RoutedFinding[]>,
  dossier: WebResearchDossier | null,
): string[] {
  const lines: string[] = [];
  for (const sectionId of WEB_SUMMARY_ORDER) {
    const list = routed.get(sectionId);
    if (!list || list.length === 0) continue;
    const lead = [...list].sort((left, right) => {
      const match =
        Number(right.matchLevel === 'strong') -
        Number(left.matchLevel === 'strong');
      if (match !== 0) return match;
      return WEB_BASIS_RANK[left.basis] - WEB_BASIS_RANK[right.basis];
    })[0];
    const quote = lead.quote ? ` “${lead.quote.slice(0, 120).trim()}”` : '';
    const more =
      list.length > 1 ? ` (${list.length} items in the section)` : '';
    const possible = lead.matchLevel === 'possible' ? 'Possible match. ' : '';
    lines.push(
      `${plainTitle(sectionId)}: ${possible}${lead.basisLabel}. ${lead.title}.${quote}${more}`,
    );
  }
  for (const verification of dossier?.verifications ?? []) {
    if (verification.status === 'confirmed') {
      lines.push(
        `${verification.claim}: listed on ${verification.confirmedBy?.name ?? 'the issuing body’s directory'}. A directory listing is not a separate official credentials file.`,
      );
    } else {
      lines.push(
        `${verification.claim}: stated on ${verification.claimedAt.length} page(s); not confirmed at the issuing body’s own site.`,
      );
    }
  }
  const others = (dossier?.candidates ?? []).filter((c) => c.role === 'other');
  if (others.length > 0) {
    lines.push(
      `${others.length} other person${others.length === 1 ? '' : 's'} with a similar name ${others.length === 1 ? 'was' : 'were'} found and kept separate.`,
    );
  }
  return lines;
}

function inconsistenciesSection(
  spec: EwiReportSectionSpec,
  input: {
    discrepancies: ExpertDiscrepancy[];
    analysis?: EwiAnalysisDocument;
  },
): ReportSectionModel {
  const blocks: ReportBlock[] = [
    {
      text: 'This section is a primary focus of the investigation. Discrepancies are limited to conflicts already present in collected statements. No inconsistency was invented.',
      style: 'note',
    },
  ];

  const items = [...input.discrepancies].sort((a, b) => {
    const priority = (item: ExpertDiscrepancy): number => {
      const hay =
        `${item.title} ${item.description} ${item.field ?? ''}`.toLowerCase();
      if (hay.includes('disciplin') || hay.includes('expir')) return 0;
      if (hay.includes('testimony') || hay.includes('cv')) return 1;
      if (hay.includes('license') || hay.includes('graduat')) return 2;
      if (hay.includes('publication') || hay.includes('author')) return 3;
      if (hay.includes('membership')) return 4;
      return 5;
    };
    return priority(a) - priority(b);
  });

  if (items.length === 0 && (input.analysis?.conflicts.length ?? 0) === 0) {
    blocks.push({
      text: 'No inconsistency was identified in the collected statements. Absence of a conflict is not verification of a credential.',
      style: 'note',
    });
  }

  for (const item of items) {
    // The title says what was not confirmed; its label is not repeated.
    const label =
      item.label &&
      item.label !== 'not_verified' &&
      item.label !== 'unable_to_verify'
        ? `${item.label.replaceAll('_', ' ')}, `
        : '';
    blocks.push({
      text: `${item.title} (${label}${item.severity})`,
      style: 'subheading',
    });
    if (item.field) {
      blocks.push({ text: `Field: ${item.field.replaceAll('_', ' ')}` });
    }
    const categoryHint = inconsistencyCategoryHint(item);
    if (categoryHint) {
      blocks.push({ text: `Discrepancy type: ${categoryHint}`, style: 'note' });
    }
    if (item.cvDate || item.cvSource) {
      blocks.push({
        text: `CV: ${[item.cvDate, item.cvSource].filter(Boolean).join(' — ')}`,
      });
    }
    if (item.previousValue) {
      blocks.push({ text: `Previous value: ${item.previousValue}` });
    }
    if (item.currentValue) {
      blocks.push({ text: `Current value: ${item.currentValue}` });
    }
    if (item.change) {
      blocks.push({ text: `Change: ${item.change}` });
    }
    if (item.supportingSource) {
      blocks.push({ text: `Supporting source: ${item.supportingSource}` });
    }
    blocks.push({ text: item.description });
    for (const source of item.sources ?? []) {
      const line = [source.sourceName, source.value].filter(Boolean).join(': ');
      blocks.push({
        text: source.url ? `${line} — ${source.url}` : line,
        link: source.url,
        style: 'citation',
      });
    }
    for (const url of item.relatedUrls) {
      if ((item.sources ?? []).some((source) => source.url === url)) continue;
      blocks.push({ text: url, link: url, style: 'citation' });
    }
  }

  for (const conflict of input.analysis?.conflicts ?? []) {
    blocks.push({
      text: withoutSingleAccount(conflict.description),
      style: 'subheading',
    });
    blocks.push({
      text: `Evidence references: ${conflict.findingKeys.join(', ')}`,
      style: 'citation',
    });
  }

  return { id: spec.id, title: spec.title, blocks };
}

function inconsistencyCategoryHint(item: ExpertDiscrepancy): string | null {
  const hay =
    `${item.title} ${item.description} ${item.field ?? ''}`.toLowerCase();
  const hints: Array<[RegExp, string]> = [
    [
      /graduat|degree|education|year/,
      'different graduation years / education claims',
    ],
    [/license date|licensure/, 'different license dates'],
    [/specialty|board[- ]cert/, 'different specialty claims'],
    [
      /publication|pmid|authorship|author/,
      'missing publications / authorship claims',
    ],
    [/membership/, 'missing memberships'],
    [/expir|lapsed|inactive/, 'expired licenses'],
    [/disciplin|sanction|board action/, 'disciplinary actions'],
    [/cv|curriculum/, 'conflicting CV information'],
    [/testimony|depos/, 'inconsistent testimony'],
  ];
  for (const [pattern, label] of hints) {
    if (pattern.test(hay)) return label;
  }
  return null;
}

/** Most important first: conflicts, then gaps, then confirmations. */
const CV_LABEL_ORDER: InconsistencyLabel[] = [
  'conflicting',
  'not_found',
  'not_verified',
  'partially_verified',
  'verified',
  'unable_to_verify',
];

function cvComparisonBlocks(row: CvComparison): ReportBlock[] {
  const blocks: ReportBlock[] = [
    { text: `[${CV_LABEL_TEXT[row.label]}] ${row.title}`, style: 'subheading' },
  ];
  if (row.cv) {
    const quote = compactCvText(row.cv.quote ?? row.cv.statement);
    blocks.push({
      text: `CV${row.cv.page ? ` (page ${row.cv.page})` : ''}: “${quote}”`,
    });
    if (row.topic === 'publication') {
      const normalized = articleTitle(row.cv.statement);
      if (normalized && normalized !== quote) {
        blocks.push({ text: `Normalized title: ${normalized}`, style: 'note' });
      }
    }
  }
  if (row.source) {
    blocks.push({ text: `${row.source.name}: ${row.source.statement}` });
  }
  if (row.note) blocks.push({ text: row.note, style: 'note' });
  if (row.source?.url) {
    blocks.push({
      text: row.source.url,
      link: row.source.url,
      style: 'citation',
    });
  }
  return blocks;
}

function cvComparedSourcesLine(check: CvCheck): string {
  const names = [
    ...new Set(
      check.comparisons
        .map((row) => row.source?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  if (names.length === 0) {
    return 'No catalog that actually ran was compared with these claims.';
  }
  return `Compared with ${names.join(', ')}.`;
}

function cvCoverageLine(check: CvCheck): string {
  const unread = [
    ...new Set([
      ...check.document.unreadablePages,
      ...(check.incompletePages ?? []),
    ]),
  ].sort((a, b) => a - b);
  if (unread.length > 0) {
    return `The CV was not fully reviewed. Unread or partially extracted pages: ${unread.join(', ')}.`;
  }
  if (check.status === 'completed') {
    return 'The readable pages of the uploaded CV were reviewed.';
  }
  return 'CV extraction was partial; some pages were not finished.';
}

function compactCvText(value: string, limit = 180): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit - 1);
  const space = sliced.lastIndexOf(' ');
  return `${(space > Math.floor(limit / 2) ? sliced.slice(0, space) : sliced).trim()}…`;
}

function cvCheckBlocks(check: CvCheck): ReportBlock[] {
  const blocks: ReportBlock[] = [
    {
      text: `Uploaded CV: ${check.document.name} (${check.document.pageCount} page${check.document.pageCount === 1 ? '' : 's'}). ${cvComparedSourcesLine(check)} ${cvCoverageLine(check)} A missing catalog result is not a confirmed discrepancy.`,
      style: 'note',
    },
    {
      text: cvComparisonCountSummary(check),
      style: 'note',
    },
    ...check.warnings.map((warning) => ({
      text: warning,
      style: 'note' as const,
    })),
  ];
  for (const label of CV_LABEL_ORDER) {
    for (const row of check.comparisons.filter(
      (item) => item.label === label,
    )) {
      blocks.push(...cvComparisonBlocks(row));
    }
  }
  return blocks;
}

function cvComparisonSection(
  spec: EwiReportSectionSpec,
  input: {
    discrepancies: ExpertDiscrepancy[];
    analysis?: EwiAnalysisDocument;
    cvCheck?: CvCheck | null;
  },
  tracker: ClaimTracker,
): ReportSectionModel {
  if (input.cvCheck) {
    // The CV finding is shown through its comparisons, not again in misc.
    claimEvidence(tracker, { categories: ['cv'] });
    return {
      id: spec.id,
      title: spec.title,
      blocks: cvCheckBlocks(input.cvCheck),
    };
  }
  const blocks: ReportBlock[] = [];
  const cvItems = claimEvidence(tracker, {
    categories: ['cv', 'profile'],
  });
  if (
    cvItems.length === 0 &&
    (input.analysis?.cvDiscrepancies.length ?? 0) === 0
  ) {
    blocks.push({
      text: 'No CV versions were collected for comparison. Multi-version CV comparison is not available from this packet.',
      style: 'note',
    });
  }
  for (const item of cvItems) {
    blocks.push(...findingBlocks(item));
  }
  for (const gap of input.analysis?.cvDiscrepancies ?? []) {
    blocks.push({ text: gap.description, style: 'subheading' });
    blocks.push({
      text: `Finding keys: ${gap.findingKeys.join(', ')}`,
      style: 'citation',
    });
  }
  const cvDiscrepancies = input.discrepancies.filter((item) => {
    const hay = `${item.field ?? ''} ${item.title}`.toLowerCase();
    return hay.includes('cv') || Boolean(item.cvSource) || Boolean(item.cvDate);
  });
  for (const item of cvDiscrepancies) {
    blocks.push({ text: item.title, style: 'subheading' });
    blocks.push({ text: item.description });
    for (const url of item.relatedUrls) {
      blocks.push({ text: url, link: url, style: 'citation' });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function boardActionsSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
): ReportSectionModel {
  const items = claimEvidence(tracker, {
    categories: ['license', 'state_license', 'board', 'disciplinary'],
    titleHints: [
      'disciplin',
      'board action',
      'sanction',
      'probation',
      'revok',
      'suspend',
    ],
  });
  return {
    id: spec.id,
    title: spec.title,
    blocks:
      items.length === 0
        ? [{ text: EMPTY, style: 'note' }]
        : items.flatMap(findingBlocks),
  };
}

function membershipsSection(
  spec: EwiReportSectionSpec,
  dossier: ProfessionalBackgroundDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  const records = uniqueProfessionalRecords([
    ...dossier.memberships,
    ...dossier.organizations,
  ]);
  markProfessionalClaimed(tracker, records);
  const blocks: ReportBlock[] = [
    {
      text: 'Claimed memberships are compared only against verified public membership information present in the packet. Missing verification is not proof of fraud.',
      style: 'note',
    },
  ];
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const record of records) {
    blocks.push(...professionalRecordBlocks(record));
    if (record.cvClaim || record.publicRecord) {
      blocks.push({
        text: `Membership comparison — CV claim: ${record.cvClaim ?? 'not stated in collected CV fields'}; public/verified record: ${record.publicRecord ?? 'not verified in collected public sources'}.`,
        style: 'note',
      });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function publicationsSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
  expertName: string,
  cvCheck?: CvCheck | null,
): ReportSectionModel {
  const items = claimEvidence(tracker, {
    categories: ['publication'],
    providers: [
      'pubmed',
      'author_verification',
      'crossref',
      'openalex',
      'orcid',
    ],
  });
  const comparisonBlocks = firstAuthorComparisonBlocks(cvCheck);
  const uniqueItems = items.filter(
    (item) => !publicationAlreadyCompared(item, cvCheck),
  );
  if (uniqueItems.length === 0 && comparisonBlocks.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [{ text: EMPTY, style: 'note' }],
    };
  }
  const blocks: ReportBlock[] = [...comparisonBlocks];
  for (const item of uniqueItems) {
    blocks.push({ text: item.title, style: 'subheading' });
    blocks.push({
      text: evidenceStatusLine(item),
      style: 'citation',
    });
    const raw = item.raw ?? {};
    const authors = stringField(raw, [
      'authors',
      'authorList',
      'author',
      'authorNames',
    ]);
    const date = stringField(raw, [
      'publicationDate',
      'publishedAt',
      'date',
      'year',
      'pubdate',
    ]);
    const journal = stringField(raw, ['journal', 'venue', 'sourceTitle']);
    const pmid = stringField(raw, ['pmid']);
    const doi = stringField(raw, ['doi']);
    const publisherLead = stringField(raw, ['leadAuthor', 'authorship']);
    const retraction = stringField(raw, [
      'retractionStatus',
      'retracted',
      'retraction',
    ]);
    if (authors) blocks.push({ text: `Authors: ${authors}` });
    if (pmid) blocks.push({ text: `PMID: ${pmid}` });
    if (doi) blocks.push({ text: `DOI: ${doi}` });
    if (date) blocks.push({ text: `Date: ${date}` });
    if (journal) blocks.push({ text: `Journal: ${journal}` });
    blocks.push({ text: `Source: ${item.sourceId}` });
    blocks.push({
      text: authorOrderLine(raw, expertName, item),
      style: 'note',
    });
    if (publisherLead) {
      blocks.push({
        text: `Publisher designation of lead author: ${publisherLead}`,
      });
    }
    if (retraction) {
      blocks.push({ text: `Retraction status: ${retraction}` });
    } else {
      blocks.push({
        text: 'Retraction status: not stated in the collected record.',
        style: 'note',
      });
    }
    if (item.access === 'restricted') {
      blocks.push({
        text: 'Restricted source. Underlying body text was not stored.',
        style: 'note',
      });
    } else if (item.summary) {
      blocks.push({ text: item.summary });
    }
    if (item.url) {
      blocks.push({ text: item.url, link: item.url, style: 'citation' });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function incomeBiasSection(
  spec: EwiReportSectionSpec,
  dossier: ProfessionalBackgroundDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  const records = uniqueProfessionalRecords(dossier.financial)
    .filter((record) => !hasEstimatedPercentage(record))
    .sort(
      (a, b) =>
        // The Open Payments totals record leads its per-company records.
        Number(isOpenPaymentsTotals(b)) - Number(isOpenPaymentsTotals(a)) ||
        compareOptionalDates(
          a.sortDate ?? a.paymentDate,
          b.sortDate ?? b.paymentDate,
        ),
    );
  markProfessionalClaimed(tracker, records);
  const blocks: ReportBlock[] = [
    {
      text: 'Income and bias-related information is presented chronologically from collected public records only. Percentages and rates are shown only when the source stated them. No percentage was inferred.',
      style: 'note',
    },
  ];
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const record of records) {
    blocks.push(...professionalRecordBlocks(record));
  }
  return { id: spec.id, title: spec.title, blocks };
}

function ordersSection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  markLegalClaimed(
    tracker,
    dossier.orders.map((order) => order.matter),
  );
  const blocks: ReportBlock[] = [
    {
      text: 'Orders are listed with significance priority (limiting, striking, critical, credibility, and qualification-related findings first), then chronologically within that ordering. Page numbers are included only when present on the collected evidence reference.',
      style: 'note',
    },
  ];
  if (dossier.orders.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const order of dossier.orders) {
    const matter = order.matter;
    blocks.push({
      text: `${matter.title}${order.sortDate ? ` (${order.sortDate})` : ''}`,
      style: 'subheading',
    });
    if (order.significanceTags.length > 0) {
      blocks.push({
        text: `Priority tags: ${order.significanceTags.join(', ')}`,
      });
    }
    blocks.push(...orderDetailBlocks(matter));
  }
  return { id: spec.id, title: spec.title, blocks };
}

function pleadingsSection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  markLegalClaimed(
    tracker,
    dossier.motionsAndPleadings.map((filing) => filing.matter),
  );
  const blocks: ReportBlock[] = [
    {
      text: 'Pleadings and motions are listed chronologically with brief descriptions and source links.',
      style: 'note',
    },
  ];
  if (dossier.motionsAndPleadings.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const filing of dossier.motionsAndPleadings) {
    blocks.push({
      text: `${filing.matter.title}${filing.sortDate ? ` (${filing.sortDate})` : ''}`,
      style: 'subheading',
    });
    blocks.push({ text: filing.description });
    if (isSearchSnippetMatter(filing.matter)) {
      blocks.push({
        text: 'Taken from a search result; the full document was not read.',
        style: 'note',
      });
    }
    if (filing.matter.caseName) {
      blocks.push({ text: `Case: ${filing.matter.caseName}` });
    }
    if (filing.matter.caseNumber) {
      blocks.push({ text: `Case number: ${filing.matter.caseNumber}` });
    }
    blocks.push({
      text: `Evidence reference: ${filing.matter.evidenceReference}`,
      style: 'citation',
    });
    if (filing.matter.sourceUrl) {
      blocks.push({
        text: filing.matter.sourceUrl,
        link: filing.matter.sourceUrl,
        style: 'citation',
      });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function depositionsSection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  markLegalClaimed(
    tracker,
    dossier.depositions.map((item) => item.matter),
  );
  const blocks: ReportBlock[] = [];
  if (dossier.depositions.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const deposition of dossier.depositions) {
    blocks.push({
      text: `${deposition.matter.title}${deposition.date ? ` (${deposition.date})` : ''}`,
      style: 'subheading',
    });
    if (deposition.caseName) {
      blocks.push({ text: `Case: ${deposition.caseName}` });
    }
    blocks.push({
      text: `Source: ${deposition.matter.sourceName} (${deposition.matter.sourceId})`,
    });
    if (deposition.transcriptMetadata) {
      blocks.push({
        text: `Transcript metadata: ${deposition.transcriptMetadata}`,
      });
    }
    if (deposition.summary) {
      blocks.push({ text: `Summary: ${deposition.summary}` });
    } else if (deposition.matter.restricted) {
      blocks.push({
        text: 'Restricted deposition reference. Transcript body was not stored. No PDF was saved.',
        style: 'note',
      });
    }
    for (const statement of deposition.importantStatements) {
      blocks.push({ text: `Statement: ${statement}` });
    }
    blocks.push({
      text: `Evidence reference: ${deposition.matter.evidenceReference}`,
      style: 'citation',
    });
    if (deposition.sourceLink) {
      blocks.push({
        text: deposition.sourceLink,
        link: deposition.sourceLink,
        style: 'citation',
      });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function testimonyInconsistenciesSection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  const blocks: ReportBlock[] = [
    {
      text: 'Separate comparison of inconsistent testimony drawn only from collected deposition/testimony statements.',
      style: 'note',
    },
  ];
  if (dossier.testimonyContradictions.length === 0) {
    const hasTestimony = tracker.evidence.some(
      (item) =>
        item.category === 'testimony' ||
        item.category === 'deposition' ||
        item.category === 'expert_testimony',
    );
    blocks.push({
      text: hasTestimony
        ? 'No contradictory testimony was identified from the collected statements.'
        : EMPTY,
      style: 'note',
    });
    return { id: spec.id, title: spec.title, blocks };
  }
  for (const entry of dossier.testimonyContradictions) {
    blocks.push({ text: entry.description, style: 'subheading' });
    blocks.push({
      text: `Statement A (${entry.sourceA}): ${entry.statementA}`,
    });
    blocks.push({
      text: `Statement B (${entry.sourceB}): ${entry.statementB}`,
    });
    blocks.push({
      text: `Evidence references: ${entry.evidenceReferences.join(', ')}`,
      style: 'citation',
    });
    for (const url of entry.relatedUrls) {
      blocks.push({ text: url, link: url, style: 'citation' });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

/** Ordinary opinions are not malpractice unless the text is a claim against the expert. */
function claimAgainstExpert(matter: LegalMatter): boolean {
  const hay =
    `${matter.caseName ?? ''} ${matter.title} ${matter.summary ?? ''} ${matter.findingsRegardingExpert ?? ''} ${matter.shortDescription ?? ''}`.toLowerCase();
  if (
    /\b(malpractice|sued|named as (a )?defendant|complaint against|liability of (the )?expert|against the (expert|witness))\b/.test(
      hay,
    )
  ) {
    return true;
  }
  return false;
}

function legalMattersSection(
  spec: EwiReportSectionSpec,
  dossier: LegalResearchDossier,
  tracker: ClaimTracker,
  predicate: (matter: LegalMatter) => boolean,
): ReportSectionModel {
  const matters = dossier.matters.filter(predicate);
  markLegalClaimed(tracker, matters);
  if (matters.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [{ text: EMPTY, style: 'note' }],
    };
  }
  const intro: ReportBlock[] =
    spec.id === 'lawsuits'
      ? [
          {
            text: 'Published opinions and public filings are listed separately. Finding an opinion is not evidence that a complete case docket or all related motions, orders, pleadings, or transcripts were reviewed.',
            style: 'note',
          },
        ]
      : [];
  return {
    id: spec.id,
    title: spec.title,
    blocks: [...intro, ...matters.flatMap((matter) => matterBlocks(matter))],
  };
}

function webDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function webRecordBlocks(record: WebRecord): ReportBlock[] {
  const published = webDate(record.publishedAt);
  const blocks: ReportBlock[] = [
    {
      text: `${record.title || record.url}${published ? ` (${published})` : ''}`,
      style: 'item',
    },
  ];
  const description = record.summary || record.snippet;
  if (description) blocks.push({ text: description });
  if (record.match.quote) {
    blocks.push({
      text: `“${record.match.quote}”${record.match.quoteVerified ? '' : ' (quote not confirmed on the page)'}`,
      style: 'citation',
    });
  }
  if (record.match.conflicts.length > 0) {
    blocks.push({
      text: `Differences from the expert: ${record.match.conflicts.join('; ')}`,
      style: 'note',
    });
  }
  if (record.read === 'restricted' || record.read === 'failed') {
    blocks.push({
      text: record.readNote ?? 'The page could not be read.',
      style: 'note',
    });
  }
  blocks.push({ text: record.url, link: record.url, style: 'citation' });
  if (record.archiveUrl) {
    blocks.push({
      text: `Archived copy: ${record.archiveUrl}`,
      link: record.archiveUrl,
      style: 'citation',
    });
  }
  return blocks;
}

function webCandidateBlocks(
  candidate: WebCandidate,
  records: WebRecord[],
): ReportBlock[] {
  const role =
    candidate.role === 'subject'
      ? 'likely the expert'
      : 'a different person with a similar name';
  const blocks: ReportBlock[] = [
    {
      text: `${candidate.label} — ${role} (${candidate.confidence} confidence)`,
      style: 'subheading',
    },
  ];
  if (candidate.basis.length > 0) {
    blocks.push({
      text: `Matched on: ${candidate.basis.join(', ')}.`,
      style: 'citation',
    });
  }
  if (candidate.role === 'other') {
    blocks.push({
      text: 'Kept separate. Nothing below is attributed to the expert.',
      style: 'note',
    });
    for (const record of records.slice(0, 10)) {
      blocks.push({
        text: `${record.title || record.url} — ${record.url}`,
        link: record.url,
        style: 'citation',
      });
    }
    if (records.length > 10) {
      blocks.push({
        text: `${records.length - 10} more page(s) about this person are omitted.`,
        style: 'note',
      });
    }
    return blocks;
  }
  return blocks;
}

/**
 * Same-name people, leftover pages, and sources that could not be read.
 * Search mechanics stay in application logs, not in this section.
 */
function webResearchSection(
  spec: EwiReportSectionSpec,
  dossier: WebResearchDossier | null,
  additionalContext: string | null,
): ReportSectionModel {
  const blocks: ReportBlock[] = [];
  const context = additionalContext?.trim();
  if (context) {
    blocks.push({
      text: 'Context supplied with the request',
      style: 'subheading',
    });
    blocks.push({ text: context });
    blocks.push({
      text: 'This text was used only to narrow identity and focus the search. It is not treated as a finding.',
      style: 'note',
    });
  }
  if (!dossier) {
    blocks.push({
      text: 'The global web search did not run for this investigation.',
      style: 'note',
    });
    return { id: spec.id, title: spec.title, blocks };
  }

  const others = dossier.candidates.filter(
    (candidate) => candidate.role === 'other',
  );
  const byId = new Map(dossier.records.map((record) => [record.id, record]));
  if (others.length > 0) {
    blocks.push({
      text: `${others.length} other ${others.length === 1 ? 'person' : 'people'} with a similar name ${others.length === 1 ? 'was' : 'were'} found and kept separate.`,
      style: 'note',
    });
  }
  for (const candidate of others) {
    const records = candidate.recordIds
      .map((id) => byId.get(id))
      .filter((record): record is WebRecord => Boolean(record));
    blocks.push(...webCandidateBlocks(candidate, records));
  }

  const otherIds = new Set(others.flatMap((candidate) => candidate.recordIds));
  const leftover = dossier.records.filter(
    (record) =>
      !otherIds.has(record.id) &&
      record.match.level !== 'other_person' &&
      record.match.level !== 'none' &&
      record.match.level !== 'strong' &&
      record.kind !== 'social',
  );
  if (leftover.length > 0) {
    blocks.push({
      text: 'Other public pages',
      style: 'subheading',
    });
    for (const record of leftover.slice(0, 12)) {
      blocks.push(...webRecordBlocks(record));
    }
  }

  if (dossier.pagesBlocked.length > 0) {
    blocks.push({
      text: 'Pages that could not be read',
      style: 'subheading',
    });
    for (const page of dossier.pagesBlocked.slice(0, 15)) {
      blocks.push({
        text: `${page.url} — ${page.reason}`,
        link: page.url,
        style: 'citation',
      });
    }
  }
  for (const registry of dossier.registries) {
    if (registry.status === 'checked' && !registry.message) continue;
    blocks.push({
      text: registry.message,
      ...(registry.url ? { link: registry.url } : {}),
      style: 'note',
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      text: 'No additional public pages remained after the findings above were assigned to their sections.',
      style: 'note',
    });
  }
  return { id: spec.id, title: spec.title, blocks };
}

function overallFindingsSection(
  spec: EwiReportSectionSpec,
  input: {
    summary?: string;
    analysis?: EwiAnalysisDocument;
    discrepancies: ExpertDiscrepancy[];
    evidence: ExpertEvidenceItem[];
    webLines?: string[];
  },
): ReportSectionModel {
  const blocks: ReportBlock[] = [
    {
      text: 'Overall findings are limited to collected evidence, packet assessments, and identified inconsistencies. Nothing was invented to fill gaps.',
      style: 'note',
    },
  ];
  if (input.analysis?.investigationFindings?.length) {
    for (const finding of input.analysis.investigationFindings) {
      blocks.push({ text: findingStatement(finding.text), style: 'item' });
      blocks.push({
        text: [
          findingLabel(finding.status),
          `Source refs: ${finding.sourceRefs.join(', ')}`,
        ]
          .filter(Boolean)
          .join(' · '),
        style: 'citation',
      });
    }
  } else if (input.summary) {
    for (const line of presentableSummaryLines(
      input.summary,
      input.analysis?.missing,
    )) {
      blocks.push({ text: line });
    }
  } else {
    blocks.push({
      text: `${reportableEvidence(input.evidence).length} evidence item(s) and ${input.discrepancies.length} inconsistency entr${input.discrepancies.length === 1 ? 'y' : 'ies'} were collected.`,
    });
  }
  if ((input.webLines ?? []).length > 0) {
    blocks.push({
      text: 'Findings from web research, by report section',
      style: 'subheading',
    });
    for (const line of input.webLines ?? []) {
      blocks.push({ text: line, style: 'item', noProof: true });
    }
  }
  // Sources that returned nothing are not listed one by one here: a line per
  // source ("Gap [unavailable] …") filled the report with negatives.
  return { id: spec.id, title: spec.title, blocks };
}

function miscellaneousSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
): ReportSectionModel {
  const leftovers = tracker.evidence.filter(
    (item, index) => !tracker.claimed.has(index) && !isWebCoverageSummary(item),
  );
  for (let index = 0; index < tracker.evidence.length; index++) {
    if (!tracker.claimed.has(index)) tracker.claimed.add(index);
  }
  if (leftovers.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [
        {
          text: 'No additional miscellaneous findings remained after section assignment.',
          style: 'note',
        },
      ],
    };
  }
  return {
    id: spec.id,
    title: spec.title,
    blocks: [
      {
        text: 'Additional relevant findings with evidence references:',
        style: 'note',
      },
      ...leftovers.flatMap(findingBlocks),
    ],
  };
}

function sourceIndexSection(
  spec: EwiReportSectionSpec,
  evidence: ExpertEvidenceItem[],
): ReportSectionModel {
  const blocks: ReportBlock[] = [
    {
      text: 'Source index of collected items. Links are included when present. Restricted items list title and link only; PDF storage is not claimed unless legally permitted and actually performed.',
      style: 'note',
    },
    {
      text: 'Abbreviations: NPI (National Provider Identifier); NPPES (National Plan and Provider Enumeration System); PMID (PubMed identifier); DOI (Digital Object Identifier); CV (curriculum vitae); IME (independent medical examination); FAPE (Free Appropriate Public Education); AACN (American Academy of Clinical Neuropsychology); ABPP (American Board of Professional Psychology); ABMS (American Board of Medical Specialties); CHEA (Council for Higher Education Accreditation); USPTO (United States Patent and Trademark Office); NIH (National Institutes of Health); PACER (Public Access to Court Electronic Records); DRI (Defense Research Institute); SEAK (expert-directory publisher).',
      style: 'note',
    },
  ];
  if (evidence.length === 0) {
    blocks.push({ text: 'No source links were collected.', style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  const seenUrl = new Set<string>();
  let index = 0;
  for (const item of evidence) {
    const urlKey = (item.url ?? '').trim().toLowerCase();
    if (urlKey) {
      if (seenUrl.has(urlKey)) continue;
      seenUrl.add(urlKey);
    }
    index += 1;
    const access =
      item.access === 'restricted'
        ? 'restricted (body not stored; PDF not saved)'
        : (item.access ?? 'public');
    blocks.push({
      text: `${index}. [${item.sourceId}] ${item.title} — access: ${access}${sourceIndexStatus(item)}`,
      style: 'item',
    });
    if (item.url) {
      blocks.push({ text: item.url, link: item.url, style: 'citation' });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

/** CV statements for a section, labeled as the resume and not as a public-source finding. */
function withCvStatements(
  section: ReportSectionModel,
  check: CvCheck | null | undefined,
  categories: string[],
): ReportSectionModel {
  const claims = (check?.claims ?? []).filter((claim) =>
    categories.includes(claim.category),
  );
  if (claims.length === 0) return section;
  const blocks = section.blocks.filter((block) => block.text !== EMPTY);
  for (const claim of claims.slice(0, 40)) {
    blocks.push({ text: claim.statement, style: 'subheading' });
    blocks.push({
      text: `Uploaded CV, page ${claim.page}: “${compactCvText(claim.quote, 160)}”`,
    });
    blocks.push({
      text: 'Stated on the uploaded CV. This is not an independent verification.',
      style: 'note',
    });
  }
  return { ...section, blocks };
}

function licensesSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
  identity: ExpertIdentityResolution | null,
): ReportSectionModel {
  const items = claimEvidence(tracker, {
    categories: ['license', 'state_license'],
    providers: ['state_license'],
    excludeHints: ['disciplin', 'board action', 'sanction'],
    excludeSourceIds: ['news', 'blogs', 'justia'],
  });
  const licenseItems = items.filter(isOfficialLicenseItem);
  const official = licenseItems.filter(
    (item) => item.sourceId === 'state_license',
  );
  const nppes = licenseItems.filter((item) => {
    if (item.sourceId !== 'npi_registry') return false;
    if (!identity) return true;
    return identity.status === 'confirmed';
  });
  const other = licenseItems.filter(
    (item) =>
      item.sourceId !== 'state_license' && item.sourceId !== 'npi_registry',
  );
  const shown = [...official, ...other, ...nppes];
  if (shown.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [{ text: EMPTY, style: 'note' }],
    };
  }
  const blocks: ReportBlock[] = [
    {
      text: 'License numbers listed by NPPES are self-reported by the clinician. They are not official state-board verification. Official verification appears only when a licensing-board lookup was completed.',
      style: 'note',
    },
  ];
  for (const item of shown) {
    blocks.push(...findingBlocks(item));
  }
  return { id: spec.id, title: spec.title, blocks };
}

function isOfficialLicenseItem(item: ExpertEvidenceItem): boolean {
  if (item.sourceId === 'state_license' || item.sourceId === 'npi_registry') {
    return true;
  }
  const url = item.url ?? '';
  return /npiregistry\.cms\.hhs\.gov|mqa-internet\.doh\.state\.fl\.us|flhealthsource\.gov|doh\.state\.fl\.us/i.test(
    url,
  );
}

function evidenceSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
  filter: {
    categories?: string[];
    providers?: string[];
    titleHints?: string[];
    excludeHints?: string[];
  },
): ReportSectionModel {
  const items = claimEvidence(tracker, filter);
  return {
    id: spec.id,
    title: spec.title,
    blocks:
      items.length === 0
        ? [{ text: EMPTY, style: 'note' }]
        : items.flatMap(findingBlocks),
  };
}

function professionalGroupSection(
  spec: EwiReportSectionSpec,
  records: ProfessionalRecord[],
  dossier: ProfessionalBackgroundDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  markProfessionalClaimed(tracker, records);
  const blocks: ReportBlock[] = [];
  // An empty section gets one neutral line; which sources were unavailable
  // is shown once, in the source list, not repeated in every section.
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
  }
  for (const record of records) {
    blocks.push(...professionalRecordBlocks(record));
  }
  return { id: spec.id, title: spec.title, blocks };
}

function presenceGroupSection(
  spec: EwiReportSectionSpec,
  records: PresenceRecord[],
  dossier: OnlinePresenceDossier,
  tracker: ClaimTracker,
): ReportSectionModel {
  markPresenceClaimed(tracker, records);
  const blocks: ReportBlock[] = [];
  // An empty section gets one neutral line; which sources were unavailable
  // is shown once, in the source list, not repeated in every section.
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
  }
  for (const record of records) {
    blocks.push(...presenceRecordBlocks(record));
  }
  return { id: spec.id, title: spec.title, blocks };
}

function uniqueProfessionalRecords(
  records: ProfessionalRecord[],
): ProfessionalRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function professionalRecordBlocks(record: ProfessionalRecord): ReportBlock[] {
  const blocks: ReportBlock[] = [{ text: record.title, style: 'subheading' }];
  const fields = [
    `Kind: ${record.kind}`,
    record.name ? `Name: ${record.name}` : null,
    record.identifier ? `Identifier: ${record.identifier}` : null,
    record.institution ? `Institution: ${record.institution}` : null,
    record.organization ? `Organization: ${record.organization}` : null,
    record.role ? `Role: ${record.role}` : null,
    record.participation ? `Participation: ${record.participation}` : null,
    record.authorship ? `Authorship: ${record.authorship}` : null,
    record.filingDate ? `Filing date: ${record.filingDate}` : null,
    record.startDate ? `Start date: ${record.startDate}` : null,
    record.endDate ? `End date: ${record.endDate}` : null,
    record.status ? `Status: ${record.status}` : null,
    record.paymentDate ? `Payment date: ${record.paymentDate}` : null,
    record.paymentAmount ? `Payment amount: ${record.paymentAmount}` : null,
    record.payer ? `Payer: ${record.payer}` : null,
    record.natureOfPayment
      ? `Nature of payment: ${record.natureOfPayment}`
      : null,
    record.hourlyRate ? `Hourly rate: ${record.hourlyRate}` : null,
    record.forensicWork ? `Forensic work: ${record.forensicWork}` : null,
    record.defenseWork ? `Defense work: ${record.defenseWork}` : null,
    record.referralInfo ? `Referral information: ${record.referralInfo}` : null,
    record.percentForensicWork
      ? `Percentage forensic work (as stated by source): ${record.percentForensicWork}`
      : null,
    record.percentDefenseWork
      ? `Percentage defense work (as stated by source): ${record.percentDefenseWork}`
      : null,
    record.cvClaim ? `CV claim: ${record.cvClaim}` : null,
    record.publicRecord ? `Public record: ${record.publicRecord}` : null,
  ].filter((line): line is string => Boolean(line));
  for (const line of fields) blocks.push({ text: line });
  if (record.summary) blocks.push({ text: record.summary });
  if (record.verificationNote) {
    blocks.push({ text: record.verificationNote, style: 'note' });
  }
  if (record.resultsAvailable === false || record.resultsUnavailableReason) {
    blocks.push({
      text:
        record.resultsUnavailableReason ??
        'Private foundation results were unavailable.',
      style: 'note',
    });
  }
  if (
    record.kind === 'open_payments' ||
    record.kind === 'forensic_income' ||
    record.kind === 'other_public_income'
  ) {
    blocks.push({
      text: 'Financial information is presented factually. Being paid is not treated as proof of bias. Percentages are shown only when the source stated them.',
      style: 'note',
    });
  }
  if (record.kind === 'military_claim' || record.kind === 'military_medal') {
    blocks.push({
      text: 'Military information is limited to the cited public source. No unsupported conclusion about military service was drawn.',
      style: 'note',
    });
  }
  for (const reference of record.evidenceReferences) {
    blocks.push({
      text: `Evidence reference: ${reference}`,
      style: 'citation',
    });
  }
  if (record.resultUrl) {
    blocks.push({
      text: record.resultUrl,
      link: record.resultUrl,
      style: 'citation',
    });
  }
  if (record.sourceUrl) {
    blocks.push({
      text: record.sourceUrl,
      link: record.sourceUrl,
      style: 'citation',
    });
  }
  return blocks;
}

function presenceRecordBlocks(record: PresenceRecord): ReportBlock[] {
  const blocks: ReportBlock[] = [{ text: record.title, style: 'subheading' }];
  const fields = [
    `Source: ${record.sourceName}`,
    record.retrievedAt ? `Retrieved: ${record.retrievedAt}` : null,
    record.publishedAt ? `Date: ${record.publishedAt}` : null,
    record.platform ? `Platform: ${record.platform}` : null,
    record.businessName ? `Business: ${record.businessName}` : null,
    record.address ? `Address: ${record.address}` : null,
    record.rating
      ? `Rating shown on the retrieved page: ${record.rating}`
      : record.kind === 'patient_review'
        ? 'Rating not shown on the retrieved page.'
        : null,
    record.reviewDate ? `Review date: ${record.reviewDate}` : null,
  ].filter((line): line is string => Boolean(line));
  for (const line of fields) blocks.push({ text: line });

  if (record.restricted) {
    blocks.push({
      text: 'Restricted or license-limited source. Public metadata and the source reference were kept. Page or review body text was not copied. No PDF was saved.',
      style: 'note',
    });
  }
  if (record.summary) blocks.push({ text: record.summary });
  if (record.description) {
    blocks.push({ text: `Description: ${record.description}` });
  }
  if (record.treatmentPracticeInfo) {
    blocks.push({
      text: `Treatment/practice information: ${record.treatmentPracticeInfo}`,
    });
  }
  for (const claim of record.relevantClaims) {
    blocks.push({ text: `Relevant claim: ${claim}` });
  }
  for (const claim of record.advertisingClaims) {
    blocks.push({ text: `Advertising claim: ${claim}` });
  }
  for (const claim of record.forensicClaims) {
    blocks.push({ text: `Forensic claim: ${claim}` });
  }
  for (const claim of record.expertWitnessClaims) {
    blocks.push({ text: `Expert witness claim: ${claim}` });
  }
  for (const indicator of record.conflictOrBiasIndicators) {
    blocks.push({ text: `Potential conflict or bias indicator: ${indicator}` });
  }
  for (const statement of record.importantStatements) {
    blocks.push({ text: `Important statement: ${statement}` });
  }
  if (record.transcript) {
    blocks.push({ text: `Transcript: ${record.transcript}` });
  } else if (
    record.transcriptAvailable === false ||
    record.transcriptUnavailableReason
  ) {
    blocks.push({
      text:
        record.transcriptUnavailableReason ??
        'This video cannot be transcribed automatically; open the link to watch it.',
      style: 'note',
    });
  }
  if (record.neutralSummary && record.kind === 'patient_review') {
    blocks.push({
      text: `Neutral summary: ${record.neutralSummary}. No medical or legal conclusion is drawn from the review.`,
      style: 'note',
    });
  }
  if (locationRequiresVerification(record)) {
    blocks.push({
      text:
        record.locationNote ??
        'Address type requires verification. No unsupported conclusion was drawn.',
      style: 'note',
    });
  }
  for (const reference of record.evidenceReferences) {
    blocks.push({
      text: `Evidence reference: ${reference}`,
      style: 'citation',
    });
  }
  if (record.url) {
    blocks.push({ text: record.url, link: record.url, style: 'citation' });
  }
  return blocks;
}

function isOpenPaymentsTotals(record: ProfessionalRecord): boolean {
  return (
    record.kind === 'open_payments' &&
    record.title.startsWith('CMS Open Payments ')
  );
}

const SEARCH_SNIPPET =
  /search snippet|search-result summary|taken from a search result/i;

function isSearchSnippetMatter(matter: LegalMatter): boolean {
  return SEARCH_SNIPPET.test(
    `${matter.summary ?? ''} ${matter.shortDescription ?? ''} ${matter.findingsRegardingExpert ?? ''}`,
  );
}

function orderDetailBlocks(matter: LegalMatter): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const snippet = isSearchSnippetMatter(matter);
  const fields = [
    matter.caseName ? `Case: ${matter.caseName}` : null,
    matter.caseNumber ? `Case number: ${matter.caseNumber}` : null,
    matter.documentDate || matter.filingDate
      ? `Date: ${matter.documentDate ?? matter.filingDate}`
      : null,
    snippet
      ? null
      : matter.findingsRegardingExpert
        ? `Finding: ${matter.findingsRegardingExpert}`
        : matter.shortDescription
          ? `Finding: ${matter.shortDescription}`
          : matter.summary && !matter.restricted
            ? `Finding: ${matter.summary}`
            : null,
    `Evidence reference: ${matter.evidenceReference}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of fields) blocks.push({ text: line });
  if (snippet) {
    blocks.push({
      text: 'Taken from a search result; the full document was not read.',
      style: 'note',
    });
  }
  if (matter.restricted) {
    blocks.push({
      text: 'Restricted source. Authorized access only. Content body and LexisNexis PDFs are not stored.',
      style: 'note',
    });
  }
  if (matter.sourceUrl) {
    blocks.push({
      text: matter.sourceUrl,
      link: matter.sourceUrl,
      style: 'citation',
    });
  }
  return blocks;
}

function matterBlocks(matter: LegalMatter, withHeading = true): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  if (withHeading) {
    blocks.push({ text: matter.title, style: 'subheading' });
  }
  const fields = [
    matter.caseName ? `Case: ${matter.caseName}` : null,
    matter.caseNumber ? `Case number: ${matter.caseNumber}` : null,
    matter.court ? `Court: ${matter.court}` : null,
    matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : null,
    matter.filingDate ? `Filing date: ${matter.filingDate}` : null,
    matter.documentDate ? `Document date: ${matter.documentDate}` : null,
    `Document type: ${matter.documentType}`,
    matter.sourceName ? `Source: ${matter.sourceName}` : null,
    matter.retrievedAt
      ? `Retrieved: ${formatInvestigationDate(matter.retrievedAt)}`
      : null,
    matter.courtLevel ? `Court level: ${matter.courtLevel}` : null,
    matter.docketCoverage === 'opinion_only' ||
    matter.docketCoverage === 'recap_document'
      ? 'Coverage: this filing is not evidence that a complete case docket was reviewed.'
      : null,
    matter.identityMatch ? `Identity matching: ${matter.identityMatch}` : null,
    matter.relevance ? `Relevance: ${matter.relevance}` : null,
    matter.findingsRegardingExpert
      ? `Findings regarding expert: ${matter.findingsRegardingExpert}`
      : null,
    `Evidence reference: ${matter.evidenceReference}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of fields) {
    blocks.push({ text: line });
  }
  if (matter.restricted) {
    blocks.push({
      text: 'Restricted source. Authorized access only. Content body and LexisNexis PDFs are not stored.',
      style: 'note',
    });
  } else if (matter.summary) {
    blocks.push({ text: matter.summary });
  }
  if (matter.sourceUrl) {
    blocks.push({
      text: matter.sourceUrl,
      link: matter.sourceUrl,
      style: 'citation',
    });
  }
  return blocks;
}

function findingBlocks(item: ExpertEvidenceItem): ReportBlock[] {
  const blocks: ReportBlock[] = [
    { text: item.title, style: 'subheading' },
    {
      text: evidenceStatusLine(item),
      style: 'citation',
    },
  ];
  if (item.identityMatch === 'uncertain') {
    blocks.push({
      text: 'Identity was not established. This record was not merged with the expert.',
      style: 'note',
    });
  }
  for (const line of evidenceDetailLines(item)) {
    blocks.push({ text: line });
  }
  if (item.access === 'restricted') {
    blocks.push({
      text: 'This source requires authorized access. The underlying content was not stored. No PDF was saved.',
      style: 'note',
    });
  } else if (item.summary) {
    blocks.push({ text: item.summary });
  } else {
    blocks.push({
      text: 'No summary text was stored for this item.',
      style: 'note',
    });
  }
  if (item.url) {
    blocks.push({ text: item.url, link: item.url, style: 'citation' });
  }
  return blocks;
}

function evidenceDetailLines(item: ExpertEvidenceItem): string[] {
  const raw = item.raw ?? {};
  const identity = raw.identity as Record<string, unknown> | undefined;
  const retrieved =
    item.retrievedAt ??
    item.source?.retrievedAt ??
    (typeof raw.retrievedAt === 'string' ? raw.retrievedAt : null);
  const lines = [
    item.source?.name ? `Source: ${item.source.name}` : null,
    retrieved ? `Retrieved: ${formatInvestigationDate(retrieved)}` : null,
    stringField(raw, ['caseNumber', 'docketNumber'])
      ? `Case number: ${stringField(raw, ['caseNumber', 'docketNumber'])}`
      : null,
    stringField(raw, ['licenseNumber'])
      ? `License number: ${stringField(raw, ['licenseNumber'])}`
      : null,
    stringField(raw, ['documentType', 'documentClass'])
      ? `Record type: ${stringField(raw, ['documentType', 'documentClass'])}`
      : null,
    stringField(raw, ['verificationStatus'])
      ? `Verification: ${verificationLabel(String(raw.verificationStatus))}`
      : null,
    identity && typeof identity.matchLevel === 'string'
      ? `Identity matching: ${identity.matchLevel}`
      : item.identityMatch
        ? `Identity matching: ${item.identityMatch}`
        : null,
    stringField(raw, ['docketCoverage']) === 'opinion_only'
      ? 'Coverage: published opinion or public filing only — not a complete docket.'
      : null,
    stringField(raw, ['cvPage', 'documentPage', 'sourcePage'])
      ? `Uploaded document page: ${stringField(raw, ['cvPage', 'documentPage', 'sourcePage'])}. This page citation comes from the uploaded document and is not an independent verification.`
      : null,
  ];
  return lines.filter((line): line is string => Boolean(line));
}

function verificationLabel(status: string): string {
  switch (status) {
    case 'official_verified':
      return 'official regulator record matched';
    case 'official_partial_match':
      return 'official regulator record, partial identity match';
    case 'nppes_self_reported':
      return 'self-reported to NPPES; not official license verification';
    default:
      return status.replace(/_/g, ' ');
  }
}

function claimEvidence(
  tracker: ClaimTracker,
  filter: {
    categories?: string[];
    providers?: string[];
    titleHints?: string[];
    excludeHints?: string[];
    excludeSourceIds?: string[];
  },
): ExpertEvidenceItem[] {
  const items: ExpertEvidenceItem[] = [];
  tracker.evidence.forEach((item, index) => {
    if (tracker.claimed.has(index)) return;
    if (isWebCoverageSummary(item)) return;
    if (filter.excludeSourceIds?.includes(item.sourceId)) return;
    if (isLegalItem(item) || isPresenceItem(item) || isProfessionalItem(item)) {
      return;
    }
    const hay = `${item.title} ${item.summary ?? ''}`.toLowerCase();
    if (filter.excludeHints?.some((hint) => hay.includes(hint.toLowerCase()))) {
      return;
    }
    const matchesProvider = filter.providers?.includes(item.sourceId) ?? false;
    const matchesCategory =
      (filter.categories?.includes(item.category) ?? false) &&
      item.sourceId !== 'expert_website';
    const matchesHint =
      filter.titleHints?.some((hint) => hay.includes(hint.toLowerCase())) ??
      false;
    if (!matchesProvider && !matchesCategory && !matchesHint) return;
    if (
      matchesCategory &&
      filter.categories?.includes('license') &&
      !isOfficialLicenseItem(item)
    ) {
      return;
    }
    tracker.claimed.add(index);
    items.push(item);
  });
  return items;
}

function markProfessionalClaimed(
  tracker: ClaimTracker,
  records: ProfessionalRecord[],
): void {
  const urls = new Set(
    records
      .flatMap((record) => [record.sourceUrl, record.resultUrl])
      .filter((url): url is string => Boolean(url)),
  );
  const titles = new Set(records.map((record) => record.title.toLowerCase()));
  tracker.evidence.forEach((item, index) => {
    if (tracker.claimed.has(index)) return;
    if (!isProfessionalItem(item)) return;
    if (
      (item.url && urls.has(item.url)) ||
      titles.has(item.title.toLowerCase())
    ) {
      tracker.claimed.add(index);
    }
  });
}

function markPresenceClaimed(
  tracker: ClaimTracker,
  records: PresenceRecord[],
): void {
  const urls = new Set(
    records
      .map((record) => record.url)
      .filter((url): url is string => Boolean(url)),
  );
  const titles = new Set(records.map((record) => record.title.toLowerCase()));
  tracker.evidence.forEach((item, index) => {
    if (tracker.claimed.has(index)) return;
    if (!isPresenceItem(item)) return;
    if (
      (item.url && urls.has(item.url)) ||
      titles.has(item.title.toLowerCase())
    ) {
      tracker.claimed.add(index);
    }
  });
}

function markLegalClaimed(tracker: ClaimTracker, matters: LegalMatter[]): void {
  const urls = new Set(
    matters
      .map((matter) => matter.sourceUrl)
      .filter((url): url is string => Boolean(url)),
  );
  const titles = new Set(matters.map((matter) => matter.title.toLowerCase()));
  tracker.evidence.forEach((item, index) => {
    if (tracker.claimed.has(index)) return;
    if (!isLegalItem(item)) return;
    if (
      (item.url && urls.has(item.url)) ||
      titles.has(item.title.toLowerCase())
    ) {
      tracker.claimed.add(index);
    }
  });
}

function authorListFromRaw(raw: Record<string, unknown>): string[] {
  for (const key of ['authors', 'authorList', 'authorNames']) {
    const value = raw[key];
    if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === 'string')
    ) {
      return value.map((entry) => entry.trim()).filter(Boolean);
    }
  }
  const joined = stringField(raw, ['authors', 'authorList', 'author']);
  if (!joined) return [];
  return joined
    .split(/\s*;\s*|\s+and\s+|,(?=\s*[A-Z])/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function publicationAlreadyCompared(
  item: ExpertEvidenceItem,
  check: CvCheck | null | undefined,
): boolean {
  const rows = (check?.comparisons ?? []).filter(
    (row) => row.topic === 'publication',
  );
  if (rows.length === 0) return false;
  const raw = item.raw ?? {};
  const pmid = stringField(raw, ['pmid']);
  const doi = stringField(raw, ['doi']);
  const title = articleTitle(item.title);
  return rows.some((row) => {
    const hay = [
      row.source?.statement,
      row.source?.url,
      row.title,
      row.cv?.statement,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (pmid && hay.includes(pmid.toLowerCase())) return true;
    if (doi && hay.includes(doi.toLowerCase())) return true;
    const rowTitle = articleTitle(row.title);
    const cvTitle = row.cv?.statement ? articleTitle(row.cv.statement) : '';
    return (
      sameTitle(title, rowTitle) ||
      (cvTitle ? sameTitle(title, cvTitle) : false)
    );
  });
}

function firstAuthorComparisonBlocks(
  check: CvCheck | null | undefined,
): ReportBlock[] {
  const rows = (check?.comparisons ?? []).filter(
    (row) => row.topic === 'publication',
  );
  if (rows.length === 0) return [];
  const blocks: ReportBlock[] = [
    { text: 'First-author and CV comparison', style: 'subheading' },
    {
      text: 'Each CV citation is compared with the catalog record (OpenAlex, PubMed, Crossref, or ORCID) by title, authors, DOI, and PubMed identifier when present. A verified author-position discrepancy means the CV listed the expert first (or in another stated place) and the catalog author list disagrees. “Misrepresentation” is not used unless the catalogs actually disagree with the CV. Equal-contribution notes are kept when the source stated them.',
      style: 'note',
    },
  ];
  for (const row of rows) {
    const klass = firstAuthorClass(row);
    blocks.push({ text: `${klass}: ${row.title}` });
    if (row.cv?.statement) {
      blocks.push({ text: `CV citation: ${compactCvText(row.cv.statement)}` });
    }
    if (row.source?.statement) {
      const catalogLabel =
        row.label === 'verified' ? 'Consistent citation' : 'Catalog record';
      blocks.push({ text: `${catalogLabel}: ${row.source.statement}` });
    }
    if (row.source?.url) {
      blocks.push({
        text: row.source.url,
        link: row.source.url,
        style: 'citation',
      });
    }
    if (row.note) blocks.push({ text: row.note, style: 'note' });
  }
  return blocks;
}

function firstAuthorClass(row: CvComparison): string {
  const hay = `${row.title} ${row.note}`.toLowerCase();
  if (row.label === 'conflicting') {
    return /author position differs/.test(hay)
      ? 'verified author-position discrepancy'
      : 'verified citation discrepancy';
  }
  if (
    /\bnot verifiable\b|\bauthor list is truncated\b|\bunable to verify\b/.test(
      hay,
    )
  ) {
    return 'unable to verify';
  }
  if (
    row.label === 'verified' &&
    /\bsole author\b|\bfirst of\b|\bfirst author\b/.test(hay)
  ) {
    return 'confirmed first author';
  }
  if (
    row.label === 'verified' &&
    /\bmiddle\b|\blast of\b|\bauthor [2-9]\b|\bauthor \d{2}\b|\blast author\b/.test(
      hay,
    )
  ) {
    return 'not first-listed';
  }
  if (row.label === 'verified') return 'not first-listed';
  return 'unable to verify';
}

function authorOrderLine(
  raw: Record<string, unknown>,
  expertName: string,
  item: ExpertEvidenceItem,
): string {
  const authors = authorListFromRaw(raw);
  if (authors.length === 0) {
    return 'Author list was not provided by the source. Author order is not stated.';
  }
  const identityName =
    (raw.identity as { name?: string } | undefined)?.name ??
    expertName ??
    item.source?.name;
  const expert = parsePersonName(String(identityName ?? expertName));
  if (!expert) {
    return `Authors were listed (${authors.length}), but this expert could not be matched in the list without guessing.`;
  }
  const place = authorPositionIn(authors, expert);
  if (!place) {
    return 'Author order: this expert is not identified in the collected author list.';
  }
  return `Author order: ${describePosition(place.position, place.index, place.count)} (PubMed/source list order). This is list position, not a publisher designation of “lead author.”`;
}

function stringField(
  raw: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (typeof value === 'number') return String(value);
    if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === 'string')
    ) {
      return value.join(', ');
    }
  }
  return null;
}

function compareOptionalDates(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
