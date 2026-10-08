import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiAnalysisDocument } from '../investigation/analysis/ewi-analysis.types';
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
  ReportBlock,
  ReportDocumentModel,
  ReportSectionModel,
} from '@platform/report/report-document';
import {
  EWI_REPORT_DISCLAIMER,
  EWI_REPORT_TEMPLATE_ID,
  EWI_REPORT_TEMPLATE_VERSION,
} from './ewi-report.version';

const EMPTY =
  'No record was collected for this section. The information could not be verified. No qualification was inferred.';

export interface EwiReportSectionSpec {
  id: string;
  title: string;
  number: number;
}

/**
 * Final EWI Word report outline (attorney review).
 * Content is built only from collected evidence and dossiers.
 */
export const EWI_REPORT_SECTIONS: EwiReportSectionSpec[] = [
  { id: 'expert-name', number: 1, title: '1. Expert Name' },
  { id: 'city', number: 2, title: '2. City' },
  { id: 'specialty', number: 3, title: '3. Specialty' },
  { id: 'investigation-date', number: 4, title: '4. Investigation Date' },
  { id: 'summary', number: 5, title: '5. Executive Summary' },
  { id: 'background', number: 6, title: '6. Expert Background' },
  {
    id: 'inconsistencies',
    number: 7,
    title: '7. Inconsistencies in Background',
  },
  { id: 'cv-comparison', number: 8, title: '8. CV Comparison' },
  { id: 'education', number: 9, title: '9. Education and Degrees' },
  {
    id: 'university-accreditation',
    number: 10,
    title: '10. University Accreditation',
  },
  { id: 'licenses', number: 11, title: '11. Licenses' },
  {
    id: 'board-actions',
    number: 12,
    title: '12. State Licensing/Board Actions',
  },
  { id: 'board-certifications', number: 13, title: '13. Board Certifications' },
  {
    id: 'certification-orgs',
    number: 14,
    title: '14. Certification Organizations',
  },
  { id: 'memberships', number: 15, title: '15. Memberships' },
  { id: 'publications', number: 16, title: '16. Publications' },
  { id: 'grants', number: 17, title: '17. Grants' },
  { id: 'patents', number: 18, title: '18. Patents' },
  {
    id: 'awards-military',
    number: 19,
    title: '19. Awards/Military Claims',
  },
  { id: 'websites', number: 20, title: '20. Expert Websites' },
  { id: 'ime', number: 21, title: '21. IME/Advertising' },
  { id: 'directories', number: 22, title: '22. Expert Directories' },
  { id: 'orders', number: 23, title: '23. Orders' },
  { id: 'pleadings', number: 24, title: '24. Pleadings/Motions' },
  { id: 'depositions', number: 25, title: '25. Depositions' },
  {
    id: 'testimony-inconsistencies',
    number: 26,
    title: '26. Testimony Inconsistencies',
  },
  {
    id: 'admissibility-challenges',
    number: 27,
    title: '27. Daubert/Frye Challenges',
  },
  { id: 'income-bias', number: 28, title: '28. Income/Bias' },
  { id: 'lawsuits', number: 29, title: '29. Lawsuits/Malpractice' },
  { id: 'criminal', number: 30, title: '30. Criminal Records' },
  { id: 'social', number: 31, title: '31. Social Media' },
  { id: 'videos', number: 32, title: '32. Videos/Transcripts' },
  { id: 'news', number: 33, title: '33. News/Blogs' },
  { id: 'university-rules', number: 34, title: '34. University Rules' },
  {
    id: 'corporate',
    number: 35,
    title: '35. Corporate Affiliations',
  },
  { id: 'patient-reviews', number: 36, title: '36. Patient Reviews' },
  {
    id: 'office-location',
    number: 37,
    title: '37. Office/Location Findings',
  },
  { id: 'misc', number: 38, title: '38. Miscellaneous Findings' },
  {
    id: 'overall-findings',
    number: 39,
    title: '39. Overall Research Findings',
  },
  { id: 'source-index', number: 40, title: '40. Source Index' },
  {
    id: 'questions',
    number: 41,
    title: '41. Cross-Examination Questions',
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
}): ReportDocumentModel {
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

  const sections: ReportSectionModel[] = EWI_REPORT_SECTIONS.map((spec) => {
    switch (spec.id) {
      case 'expert-name':
        return simpleFieldSection(spec, `Expert name: ${input.expertName}`);
      case 'city':
        return simpleFieldSection(spec, `City: ${input.city}`);
      case 'specialty':
        return simpleFieldSection(spec, `Specialty: ${input.specialty}`);
      case 'investigation-date':
        return simpleFieldSection(
          spec,
          `Investigation date: ${formatInvestigationDate(input.generatedAt)}`,
        );
      case 'summary':
        return summarySection(spec, input);
      case 'background':
        return backgroundSection(spec, tracker, input.identity ?? null);
      case 'inconsistencies':
        return inconsistenciesSection(spec, input);
      case 'cv-comparison':
        return cvComparisonSection(spec, input, tracker);
      case 'education':
        return evidenceSection(spec, tracker, {
          categories: ['education'],
        });
      case 'university-accreditation':
        return evidenceSection(spec, tracker, {
          categories: ['university', 'accreditation'],
          providers: ['university'],
          titleHints: ['accredit', 'university'],
        });
      case 'licenses':
        return evidenceSection(spec, tracker, {
          categories: ['license', 'state_license'],
          providers: ['state_license'],
          excludeHints: ['disciplin', 'board action', 'sanction'],
        });
      case 'board-actions':
        return boardActionsSection(spec, tracker);
      case 'board-certifications':
        return evidenceSection(spec, tracker, {
          categories: ['board', 'board_certification', 'certification'],
          excludeHints: ['organization'],
        });
      case 'certification-orgs':
        return evidenceSection(spec, tracker, {
          categories: ['certification_organization'],
          titleHints: ['certification organization', 'abms', 'board of'],
        });
      case 'memberships':
        return membershipsSection(spec, professionalDossier, tracker);
      case 'publications':
        return publicationsSection(spec, tracker);
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
              matter.documentType === 'case' ||
              matter.documentType === 'expert_witness_case'),
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
        return presenceGroupSection(
          spec,
          presenceDossier.locations,
          presenceDossier,
          tracker,
        );
      case 'misc':
        return miscellaneousSection(spec, tracker);
      case 'overall-findings':
        return overallFindingsSection(spec, input);
      case 'source-index':
        return sourceIndexSection(spec, input.evidence);
      case 'questions':
        return questionsSection(spec, input.questions);
      default:
        return {
          id: spec.id,
          title: spec.title,
          blocks: [{ text: EMPTY, style: 'note' }],
        };
    }
  });

  const safeName = input.expertName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    product: 'ewi',
    templateId: EWI_REPORT_TEMPLATE_ID,
    templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    title: 'Expert Witness Investigation Report',
    subtitle: `${input.expertName} — ${input.city} — ${input.specialty}`,
    headerLabel: 'Expert Witness Investigation',
    fileName: `ewi-${safeName || 'expert'}-report.docx`,
    generatedAt: input.generatedAt,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    format: 'docx',
    includeTableOfContents: true,
    metadata: {
      expertName: input.expertName,
      city: input.city,
      specialty: input.specialty,
      investigationDate: formatInvestigationDate(input.generatedAt),
      reportVersion: EWI_REPORT_TEMPLATE_VERSION,
      templateId: EWI_REPORT_TEMPLATE_ID,
      product: 'ewi',
      disclaimer: EWI_REPORT_DISCLAIMER,
    },
    sections,
  };
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
    ambiguous: 'Identity not confirmed — several possible NPI records',
    not_found: 'No matching NPI Registry record',
    npi_mismatch: 'The supplied NPI does not match the expert',
    unavailable: 'NPI Registry not checked',
  };

function identityBlocks(
  identity: ExpertIdentityResolution | null,
): ReportBlock[] {
  if (!identity) return [];
  const blocks: ReportBlock[] = [
    { text: IDENTITY_STATUS_TEXT[identity.status], style: 'subheading' },
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
      text: `Possible record: NPI ${candidate.npi} — ${candidate.name}${candidate.taxonomy ? `, ${candidate.taxonomy}` : ''}${candidate.city ? `, ${candidate.city}${candidate.state ? `, ${candidate.state}` : ''}` : ''}`,
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

function summarySection(
  spec: EwiReportSectionSpec,
  input: {
    summary?: string;
    analysis?: EwiAnalysisDocument;
    expertName: string;
    city: string;
    specialty: string;
    evidence: ExpertEvidenceItem[];
    questions: CrossExamQuestion[];
  },
): ReportSectionModel {
  const text =
    input.summary?.trim() ||
    input.analysis?.summary ||
    'The investigation could not verify a qualification from the collected sources.';
  const blocks: ReportBlock[] = [
    {
      text: `Subject: ${input.expertName}, ${input.city}, ${input.specialty}.`,
    },
    ...text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ text: line })),
    {
      text: `${input.evidence.length} collected evidence item(s) and ${input.questions.length} cross-examination question(s) are included.`,
      style: 'note',
    },
    { text: EWI_REPORT_DISCLAIMER, style: 'note' },
  ];
  return { id: spec.id, title: spec.title, blocks };
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
    const label = item.label ? item.label.replaceAll('_', ' ') : item.severity;
    blocks.push({
      text: `${item.title} (${label}, ${item.severity})`,
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
      text: conflict.description,
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

function cvComparisonSection(
  spec: EwiReportSectionSpec,
  input: {
    discrepancies: ExpertDiscrepancy[];
    analysis?: EwiAnalysisDocument;
  },
  tracker: ClaimTracker,
): ReportSectionModel {
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
): ReportSectionModel {
  const items = claimEvidence(tracker, {
    categories: ['publication'],
    providers: ['pubmed', 'author_verification', 'crossref', 'openalex'],
  });
  if (items.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [{ text: EMPTY, style: 'note' }],
    };
  }
  const blocks: ReportBlock[] = [];
  for (const item of items) {
    blocks.push({ text: item.title, style: 'subheading' });
    blocks.push({
      text: `Status: ${statusLabel(item)}. Source: ${item.sourceId}.`,
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
    ]);
    const journal = stringField(raw, ['journal', 'venue', 'sourceTitle']);
    const lead = stringField(raw, [
      'firstAuthor',
      'leadAuthor',
      'isFirstAuthor',
      'authorship',
    ]);
    const retraction = stringField(raw, [
      'retractionStatus',
      'retracted',
      'retraction',
    ]);
    if (authors) blocks.push({ text: `Authors: ${authors}` });
    if (date) blocks.push({ text: `Date: ${date}` });
    if (journal) blocks.push({ text: `Journal: ${journal}` });
    blocks.push({ text: `Source: ${item.sourceId}` });
    if (lead) {
      blocks.push({ text: `First/lead author status: ${lead}` });
    } else {
      blocks.push({
        text: 'First/lead author status: not stated in the collected record.',
        style: 'note',
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
  return {
    id: spec.id,
    title: spec.title,
    blocks: matters.flatMap((matter) => matterBlocks(matter)),
  };
}

function overallFindingsSection(
  spec: EwiReportSectionSpec,
  input: {
    summary?: string;
    analysis?: EwiAnalysisDocument;
    discrepancies: ExpertDiscrepancy[];
    evidence: ExpertEvidenceItem[];
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
      blocks.push({
        text: `[${finding.status}] ${finding.text}`,
      });
      blocks.push({
        text: `Source refs: ${finding.sourceRefs.join(', ')}`,
        style: 'citation',
      });
    }
  } else if (input.summary) {
    blocks.push({ text: input.summary });
  } else {
    blocks.push({
      text: `${input.evidence.length} evidence item(s) and ${input.discrepancies.length} inconsistency entr${input.discrepancies.length === 1 ? 'y' : 'ies'} were collected.`,
    });
  }
  for (const missing of input.analysis?.missing ?? []) {
    blocks.push({
      text: `Gap [${missing.assessment}] ${missing.category}: ${missing.note}`,
      style: 'note',
    });
    if (missing.sourceRefs.length) {
      blocks.push({
        text: `Source refs: ${missing.sourceRefs.join(', ')}`,
        style: 'citation',
      });
    }
  }
  return { id: spec.id, title: spec.title, blocks };
}

function miscellaneousSection(
  spec: EwiReportSectionSpec,
  tracker: ClaimTracker,
): ReportSectionModel {
  const leftovers = tracker.evidence.filter(
    (_, index) => !tracker.claimed.has(index),
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
  ];
  if (evidence.length === 0) {
    blocks.push({ text: 'No source links were collected.', style: 'note' });
    return { id: spec.id, title: spec.title, blocks };
  }
  evidence.forEach((item, index) => {
    const access =
      item.access === 'restricted'
        ? 'restricted (body not stored; PDF not saved)'
        : (item.access ?? 'public');
    blocks.push({
      text: `${index + 1}. [${item.sourceId}] ${item.title} — access: ${access}; status: ${item.informationStatus ?? 'unverified'}`,
      style: 'citation',
    });
    if (item.url) {
      blocks.push({ text: item.url, link: item.url, style: 'citation' });
    }
  });
  return { id: spec.id, title: spec.title, blocks };
}

function questionsSection(
  spec: EwiReportSectionSpec,
  questions: CrossExamQuestion[],
): ReportSectionModel {
  if (questions.length === 0) {
    return {
      id: spec.id,
      title: spec.title,
      blocks: [
        {
          text: 'Cross-examination questions were not generated. No collected finding was available, and facts were not invented to create questions.',
          style: 'note',
        },
      ],
    };
  }
  const blocks: ReportBlock[] = [
    {
      text: `${questions.length} aggressive leading cross-examination question(s) grounded in collected evidence. Each question cites its evidence basis.`,
      style: 'note',
    },
  ];
  for (const question of questions) {
    blocks.push({ text: `${question.number}. ${question.question}` });
    blocks.push({
      text: `Basis: ${question.evidenceBasis}`,
      style: 'citation',
    });
  }
  return { id: spec.id, title: spec.title, blocks };
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
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
  }
  const unavailable = dossier.sourceAttempts.filter(
    (attempt) =>
      attempt.status === 'unavailable' ||
      attempt.outcome === 'unavailable' ||
      attempt.outcome === 'no_result',
  );
  if (unavailable.length > 0 && records.length === 0) {
    blocks.push({
      text: 'Unavailable or empty professional sources for this section were recorded as such. Those sources were not treated as completed negative findings.',
      style: 'note',
    });
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
  const unavailable = dossier.sourceAttempts.filter(
    (attempt) =>
      attempt.status === 'unavailable' ||
      attempt.outcome === 'unavailable' ||
      attempt.outcome === 'authentication_required',
  );
  if (records.length === 0) {
    blocks.push({ text: EMPTY, style: 'note' });
  }
  if (unavailable.length > 0 && records.length === 0) {
    blocks.push({
      text: 'Unavailable online presence sources for this section were recorded as unavailable. Those sources were not treated as completed searches.',
      style: 'note',
    });
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
    record.rating ? `Rating: ${record.rating}` : null,
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
  if (
    record.transcriptAvailable === false ||
    record.transcriptUnavailableReason
  ) {
    blocks.push({
      text:
        record.transcriptUnavailableReason ?? 'Transcription was unavailable.',
      style: 'note',
    });
  } else if (record.transcript) {
    blocks.push({ text: `Transcript excerpt: ${record.transcript}` });
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

function orderDetailBlocks(matter: LegalMatter): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const fields = [
    matter.caseName ? `Case: ${matter.caseName}` : null,
    matter.caseNumber ? `Case number: ${matter.caseNumber}` : null,
    matter.documentDate || matter.filingDate
      ? `Date: ${matter.documentDate ?? matter.filingDate}`
      : null,
    matter.findingsRegardingExpert
      ? `Finding: ${matter.findingsRegardingExpert}`
      : matter.shortDescription
        ? `Finding: ${matter.shortDescription}`
        : matter.summary && !matter.restricted
          ? `Finding: ${matter.summary}`
          : null,
    `Evidence reference: ${matter.evidenceReference}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of fields) blocks.push({ text: line });
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
      text: `Status: ${statusLabel(item)}. Source: ${item.sourceId}.`,
      style: 'citation',
    },
  ];
  if (item.identityMatch === 'uncertain') {
    blocks.push({
      text: 'Identity was not established. This record was not merged with the expert.',
      style: 'note',
    });
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

function statusLabel(item: ExpertEvidenceItem): string {
  if (item.access === 'restricted') return 'Restricted';
  if (item.informationStatus === 'conflicting') return 'Conflicting';
  if (item.informationStatus === 'verified') return 'Verified';
  if (item.informationStatus === 'unavailable') return 'Unavailable';
  return 'Not Verified';
}

function claimEvidence(
  tracker: ClaimTracker,
  filter: {
    categories?: string[];
    providers?: string[];
    titleHints?: string[];
    excludeHints?: string[];
  },
): ExpertEvidenceItem[] {
  const items: ExpertEvidenceItem[] = [];
  tracker.evidence.forEach((item, index) => {
    if (tracker.claimed.has(index)) return;
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
