import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiAnalysisDocument } from '../investigation/analysis/ewi-analysis.types';
import type {
  ReportDocumentModel,
  ReportSectionModel,
} from '@platform/report/report-document';
import {
  EWI_REPORT_TEMPLATE_ID,
  EWI_REPORT_TEMPLATE_VERSION,
} from './ewi-report.version';

const EMPTY =
  'No record was collected for this section. The information could not be verified. No qualification was inferred.';

interface SectionSpec {
  id: string;
  title: string;
  providers?: string[];
  categories?: string[];
}

export const EWI_REPORT_SECTIONS: SectionSpec[] = [
  { id: 'overview', title: '1. Expert Overview' },
  { id: 'summary', title: '2. Executive Summary' },
  {
    id: 'identity',
    title: '3. Identity/Profile',
    providers: ['web_search', 'orcid'],
  },
  {
    id: 'education',
    title: '4. Education and Degrees',
    categories: ['education'],
  },
  {
    id: 'licenses',
    title: '5. Medical Licenses',
    providers: ['state_license'],
    categories: ['license'],
  },
  {
    id: 'boards',
    title: '6. Board Certifications',
    categories: ['board', 'certification'],
  },
  {
    id: 'publications',
    title: '7. Publications and Authorship',
    providers: ['pubmed', 'author_verification', 'crossref', 'openalex'],
    categories: ['publication'],
  },
  {
    id: 'grants',
    title: '8. Grants',
    providers: ['grants'],
    categories: ['grant'],
  },
  {
    id: 'patents',
    title: '9. Patents',
    providers: ['patents'],
    categories: ['patent'],
  },
  { id: 'awards', title: '10. Awards and Medals', categories: ['award'] },
  {
    id: 'legal',
    title: '11. Legal/Case Research',
    providers: ['courtlistener', 'lexisnexis'],
    categories: ['legal'],
  },
  {
    id: 'directories',
    title: '12. Expert Witness Directories',
    providers: ['expert_directory'],
    categories: ['directory'],
  },
  {
    id: 'websites',
    title: '13. Expert Websites',
    providers: ['expert_website'],
  },
  {
    id: 'ime',
    title: '14. IME/Advertising Research',
    providers: ['ime_advertising'],
  },
  {
    id: 'videos',
    title: '15. Videos and Presentations',
    providers: ['youtube'],
    categories: ['video'],
  },
  {
    id: 'social',
    title: '16. Social Media',
    providers: ['social'],
    categories: ['social'],
  },
  {
    id: 'news',
    title: '17. News and Blogs',
    providers: ['news'],
    categories: ['news'],
  },
  {
    id: 'university-rules',
    title: '18. University/Professional Rules',
    providers: ['university'],
  },
  { id: 'discrepancies', title: '19. Findings and Discrepancies' },
  { id: 'sources', title: '20. Sources and Links' },
  { id: 'limitations', title: '21. Research Limitations' },
  { id: 'questions', title: '22. Cross-Examination Questions' },
];

export function buildEwiReportDocument(input: {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  generatedAt: string;
  summary?: string;
  analysis?: EwiAnalysisDocument;
}): ReportDocumentModel {
  const claimed = new Set<number>();
  const sections: ReportSectionModel[] = EWI_REPORT_SECTIONS.map((spec) => {
    if (spec.id === 'overview') return overview(input);
    if (spec.id === 'summary') return summarySection(input);
    if (spec.id === 'discrepancies') return discrepancySection(input);
    if (spec.id === 'sources') return sourcesSection(input.evidence);
    if (spec.id === 'limitations') return limitationsSection(input);
    if (spec.id === 'questions') return questionsSection(input.questions);
    const items = input.evidence.filter((item, index) => {
      if (claimed.has(index)) return false;
      const matchesProvider = spec.providers?.includes(item.sourceId) ?? false;
      const matchesCategory =
        (spec.categories?.includes(item.category) ?? false) &&
        item.sourceId !== 'expert_website';
      if (!matchesProvider && !matchesCategory) return false;
      claimed.add(index);
      return true;
    });
    return {
      id: spec.id,
      title: spec.title,
      blocks:
        items.length === 0
          ? [{ text: EMPTY, style: 'note' }]
          : items.flatMap(findingBlocks),
    };
  });

  const safeName = input.expertName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    product: 'ewi',
    templateId: EWI_REPORT_TEMPLATE_ID,
    templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    title: 'Expert Witness Investigation Report',
    subtitle: `${input.expertName} — ${input.specialty}`,
    headerLabel: 'Expert Witness Investigation',
    fileName: `ewi-${safeName || 'expert'}-report.docx`,
    generatedAt: input.generatedAt,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    format: 'docx',
    sections,
  };
}

function overview(input: {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  questions: CrossExamQuestion[];
}): ReportSectionModel {
  return {
    id: 'overview',
    title: '1. Expert Overview',
    blocks: [
      {
        text: `This report concerns ${input.expertName}, identified for research in ${input.specialty}. It is attorney work product and is not a certification of any credential.`,
      },
      {
        text: `${input.evidence.length} collected item(s) and ${input.questions.length} cross-examination question(s) are included. Items that are unverified are labeled as such.`,
        style: 'note',
      },
    ],
  };
}

function summarySection(input: {
  summary?: string;
  analysis?: EwiAnalysisDocument;
}): ReportSectionModel {
  const text =
    input.summary?.trim() ||
    input.analysis?.summary ||
    'The investigation could not verify a qualification from the collected sources.';
  return {
    id: 'summary',
    title: '2. Executive Summary',
    blocks: text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ text: line })),
  };
}

function findingBlocks(item: ExpertEvidenceItem): ReportSectionModel['blocks'] {
  const status =
    item.access === 'restricted'
      ? 'Restricted/Unavailable'
      : item.informationStatus === 'conflicting'
        ? 'Conflicting'
        : item.informationStatus === 'verified'
          ? 'Verified'
          : 'Unverified';
  const blocks: ReportSectionModel['blocks'] = [
    { text: item.title, style: 'subheading' },
    {
      text: `Status: ${status}. Source: ${item.sourceId}.`,
      style: 'citation',
    },
  ];
  if (item.access === 'restricted') {
    blocks.push({
      text: 'This source requires authorized access. The underlying content was not stored.',
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

function discrepancySection(input: {
  discrepancies: ExpertDiscrepancy[];
  analysis?: EwiAnalysisDocument;
}): ReportSectionModel {
  const blocks: ReportSectionModel['blocks'] = [];
  const items = input.discrepancies;
  if (items.length === 0 && (input.analysis?.conflicts.length ?? 0) === 0) {
    blocks.push({
      text: 'No conflict between collected statements was identified. Absence of a conflict is not verification of a credential.',
      style: 'note',
    });
  }
  for (const item of items) {
    blocks.push({
      text: `${item.title} (${item.severity})`,
      style: 'subheading',
    });
    blocks.push({ text: item.description });
    for (const url of item.relatedUrls) {
      blocks.push({ text: url, link: url, style: 'citation' });
    }
  }
  return {
    id: 'discrepancies',
    title: '19. Findings and Discrepancies',
    blocks,
  };
}

function sourcesSection(evidence: ExpertEvidenceItem[]): ReportSectionModel {
  const links = evidence.filter((item) => item.url);
  return {
    id: 'sources',
    title: '20. Sources and Links',
    blocks:
      links.length === 0
        ? [{ text: 'No source links were collected.', style: 'note' }]
        : links.map((item) => ({
            text: `${item.sourceId}: ${item.title} — ${item.url}`,
            link: item.url,
            style: 'citation' as const,
          })),
  };
}

function limitationsSection(input: {
  evidence: ExpertEvidenceItem[];
}): ReportSectionModel {
  const restricted = input.evidence.filter(
    (item) => item.access === 'restricted',
  ).length;
  return {
    id: 'limitations',
    title: '21. Research Limitations',
    blocks: [
      {
        text: 'This report repeats collected source statements and source-derived analysis. It does not add publications, degrees, licenses, cases, awards, employment, or statistics that were not collected.',
      },
      {
        text: 'A source that returned nothing, or that requires authorized access, is not evidence that the expert lacks a qualification.',
      },
      {
        text:
          restricted > 0
            ? `${restricted} restricted item(s) are listed by title and link only.`
            : 'No restricted document body was stored in this report.',
        style: 'note',
      },
      {
        text: `Report template ${EWI_REPORT_TEMPLATE_ID} version ${EWI_REPORT_TEMPLATE_VERSION}.`,
        style: 'citation',
      },
    ],
  };
}

function questionsSection(questions: CrossExamQuestion[]): ReportSectionModel {
  if (questions.length === 0) {
    return {
      id: 'questions',
      title: '22. Cross-Examination Questions',
      blocks: [
        {
          text: 'Cross-examination questions were not generated. No collected finding was available, and facts were not invented to create questions.',
          style: 'note',
        },
      ],
    };
  }
  return {
    id: 'questions',
    title: '22. Cross-Examination Questions',
    blocks: questions.flatMap((question) => [
      { text: `${question.number}. ${question.question}` },
      { text: `Basis: ${question.evidenceBasis}`, style: 'citation' as const },
    ]),
  };
}
