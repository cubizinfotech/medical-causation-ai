import type {
  ReportBlock,
  ReportDocumentModel,
  ReportIconName,
  ReportSectionModel,
} from '@platform/report/report-document';
import { formatPageList } from '../records/chronology-extraction.service';
import type {
  AnalysisCitation,
  BillingPrintedTotal,
  ChronologyEvent,
  ChronologyEventType,
  ClassifiedEvidence,
  DefenseIssue,
  EvidenceBasisMode,
  MedicalAnalysisResult,
} from '../types';
import {
  MCA_REPORT_POLICY_FOOTER,
  MCA_REPORT_POLICY_SECTIONS,
  MCA_REPORT_TEMPLATE_ID,
  MCA_REPORT_TEMPLATE_VERSION,
} from './mca-report.version';

/** The case as entered at intake, shown on the cover. */
export interface McaReportCase {
  patientAge: string;
  patientGender: string;
  accidentDate: string;
  accidentType: string;
  diagnosis: string;
  medicalQuestion: string;
}

const MODE_LABELS: Record<EvidenceBasisMode, string> = {
  knowledge_base: 'Firm medical library',
  knowledge_base_and_literature: 'Firm library and published studies',
  literature: 'Published studies (PubMed)',
  general_knowledge: 'AI reasoning only — no cited source',
};

const SOURCE_LABELS: Record<
  NonNullable<AnalysisCitation['sourceKind']>,
  string
> = {
  knowledge_base: 'Firm library',
  public_literature: 'PubMed',
  medical_record: 'Client record',
};

const EVENT_TYPES: Record<ChronologyEventType, string> = {
  emergency: 'Emergency visit',
  office_visit: 'Office visit',
  hospital_admission: 'Hospital admission',
  imaging: 'Imaging',
  lab: 'Lab result',
  procedure: 'Procedure',
  surgery: 'Surgery',
  therapy: 'Therapy',
  medication: 'Medication',
  other: 'Other',
};

const SEVERITY: Record<DefenseIssue['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRINTED_LABEL: Record<BillingPrintedTotal['kind'], string> = {
  total_charges: 'Total charges',
  payments: 'Payments',
  adjustments: 'Adjustments',
  balance: 'Balance due',
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  supporting: 'Supporting',
  opposing: 'Opposing',
  neutral: 'Neutral',
  unknown: 'Referenced',
};

/** Matches the server default (MCA_RECORDS_OCR_LOW_CONFIDENCE). */
const LOW_OCR_CONFIDENCE = 60;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/**
 * The finished causation analysis as a report document (exported to Word).
 * Sections follow the web report in order and repeat only what the saved
 * analysis contains; nothing is added or inferred here.
 */
export function buildMcaReportDocument(input: {
  result: MedicalAnalysisResult;
  caseDetails: McaReportCase;
}): ReportDocumentModel {
  const { result, caseDetails } = input;
  const crossExamCount =
    result.metadata.crossExamQuestionCount ??
    result.crossExamination.reduce(
      (sum, category) => sum + category.questions.length,
      0,
    );

  const sections: ReportSectionModel[] = [
    ...coverFacts(result, caseDetails),
    {
      id: 'summary',
      title: 'Executive Summary',
      placement: 'cover-summary',
      blocks: [{ text: result.executiveSummary }],
    },
  ];
  const card = (
    id: string,
    title: string,
    icon: ReportIconName,
    blocks: ReportBlock[],
  ) => sections.push({ id, title, icon, blocks });

  if (result.evidenceBasis) {
    card(
      'evidence-basis',
      'Evidence Basis',
      'layers',
      evidenceBasisBlocks(result),
    );
  }
  card('confidence', 'Confidence Score', 'scale', [
    { text: `Evidence alignment score: ${result.confidenceScore.score}/100` },
    { text: result.confidenceScore.explanation },
    { text: result.confidenceScore.disclaimer, style: 'note' },
  ]);
  card('opinion', 'Medical Causation Opinion', 'gavel', [
    { text: result.causationOpinion || result.conclusion },
    ...(result.patientSummary
      ? [{ text: `Patient summary: ${result.patientSummary}` }]
      : []),
  ]);
  card(
    'supporting',
    'Supporting Evidence',
    'badge-check',
    evidenceBlocks(
      result.supportingEvidence,
      'No supporting evidence identified.',
    ),
  );
  card(
    'opposing',
    'Opposing Evidence',
    'alert-triangle',
    evidenceBlocks(result.opposingEvidence, 'No opposing evidence identified.'),
  );
  card('reasoning', 'Medical Reasoning', 'lightbulb', [
    ...paragraphs(result.aiReasoning),
    ...(result.limitations.length > 0
      ? [
          { text: 'Limitations', style: 'heading' as const },
          ...result.limitations.map((item) => ({
            text: `• ${item}`,
            style: 'note' as const,
          })),
        ]
      : []),
  ]);
  if (result.alternativeExplanations) {
    card(
      'alternatives',
      'Alternative Explanations',
      'git-compare',
      alternativeBlocks(result),
    );
  }
  if (result.generalMedicalKnowledge?.length) {
    card('uncited', 'Uncited AI Reasoning', 'message-square-warning', [
      {
        text: "These points come from the AI model's general medical knowledge. No source in the firm library or PubMed was cited for them; have a qualified medical expert verify them before relying on them.",
        style: 'note',
      },
      ...result.generalMedicalKnowledge.map((statement) => ({
        text: `• ${statement}`,
      })),
    ]);
  }
  card(
    'timeline',
    'Timeline of Events',
    'list',
    result.timelineEvents.length === 0
      ? [{ text: 'No timeline events were listed.', style: 'note' }]
      : result.timelineEvents.flatMap((event) => [
          { text: event.date, style: 'subheading' as const },
          { text: event.event },
          { text: event.significance, style: 'note' as const },
        ]),
  );
  if (result.chronology) {
    card(
      'chronology',
      'Medical Chronology',
      'clipboard-list',
      chronologyBlocks(result),
    );
  }
  if (result.defenseIssues) {
    card(
      'defense',
      'Defense Issues (Bad Facts)',
      'shield-alert',
      defenseBlocks(result),
    );
  }
  if (result.medicalSpecials) {
    card(
      'specials',
      'Medical Bills (Specials)',
      'banknote',
      specialsBlocks(result),
    );
  }
  card(
    'risk-factors',
    'Risk Factors',
    'alert-triangle',
    result.riskFactors.length === 0
      ? [{ text: 'No risk factors were listed.', style: 'note' }]
      : result.riskFactors.flatMap((factor) => [
          {
            text: `${factor.factor} (${factor.category})`,
            style: 'subheading' as const,
          },
          { text: factor.impact },
        ]),
  );
  card(
    'literature',
    'Published Medical Literature',
    'globe',
    literatureBlocks(result),
  );
  card(
    'library',
    'Private Knowledge Base Sources',
    'book-open',
    libraryBlocks(result),
  );
  card('cross-exam', 'Cross-Examination Questions', 'gavel', [
    {
      text: `${crossExamCount} leading questions organized for challenging opposing medical experts.`,
      style: 'note',
    },
    ...result.crossExamination.flatMap((category) => [
      { text: category.name, style: 'heading' as const },
      ...category.questions.flatMap((question, index) => [
        { text: `${index + 1}. ${question.question}`, style: 'item' as const },
        { text: question.purpose, style: 'note' as const },
      ]),
    ]),
  ]);
  card('legal-disclaimer', 'Legal Disclaimer', 'file-text', [
    { text: result.legalDisclaimer, style: 'note' },
  ]);
  card('terms', 'Terms, Conditions & Policy', 'scroll-text', [
    {
      text: 'This report is generated by Medical Causation AI. Please review the following terms before relying on this output in any legal, medical, or business context.',
    },
    ...MCA_REPORT_POLICY_SECTIONS.flatMap((policy) => [
      { text: policy.title, style: 'heading' as const },
      { text: policy.body },
    ]),
    { text: MCA_REPORT_POLICY_FOOTER, style: 'note' },
  ]);

  const day = result.metadata.generatedAt.slice(0, 10);
  return {
    product: 'mca',
    templateId: MCA_REPORT_TEMPLATE_ID,
    templateVersion: MCA_REPORT_TEMPLATE_VERSION,
    title: 'Medical Causation Analysis Report',
    headerLabel: 'Medical Causation Analysis',
    fileName: `medical-causation-report-${/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'export'}.docx`,
    generatedAt: result.metadata.generatedAt,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    format: 'docx',
    includeTableOfContents: true,
    highlights: [
      `Confidence: ${result.confidenceScore.score}/100`,
      count(
        result.supportingEvidence.length,
        'supporting source',
        'supporting sources',
      ),
      count(
        result.opposingEvidence.length,
        'opposing source',
        'opposing sources',
      ),
      count(
        result.privateReferences.length,
        'knowledge-base passage',
        'knowledge-base passages',
      ),
      count(crossExamCount, 'cross-exam question', 'cross-exam questions'),
    ],
    metadata: {
      reportVersion: MCA_REPORT_TEMPLATE_VERSION,
      templateId: MCA_REPORT_TEMPLATE_ID,
      product: 'mca',
    },
    sections,
  };
}

function coverFacts(
  result: MedicalAnalysisResult,
  caseDetails: McaReportCase,
): ReportSectionModel[] {
  const gender = caseDetails.patientGender.trim();
  const patient = [
    caseDetails.patientAge.trim() ? `Age ${caseDetails.patientAge.trim()}` : '',
    gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const facts: Array<[string, string, string]> = [
    [
      'medical-question',
      'Medical question',
      result.medicalQuestion || caseDetails.medicalQuestion,
    ],
    ['patient', 'Patient', patient],
    [
      'date-of-loss',
      'Date of loss',
      caseDetails.accidentDate ? eventDate(caseDetails.accidentDate) : '',
    ],
    ['accident-type', 'Accident type', caseDetails.accidentType],
    ['diagnosis', 'Diagnosis', caseDetails.diagnosis],
    [
      'ai-model',
      'AI model',
      `${result.metadata.llmProvider} / ${result.metadata.llmModel}`,
    ],
  ];
  return facts
    .filter(([, , value]) => value.trim())
    .map(([id, title, value]) => ({
      id,
      title,
      placement: 'cover-fact' as const,
      blocks: [{ text: value }],
    }));
}

function evidenceBasisBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const basis = result.evidenceBasis!;
  const counts = [
    count(basis.knowledgeBasePassages, 'library passage', 'library passages'),
    count(basis.literatureArticles, 'PubMed abstract', 'PubMed abstracts'),
    basis.recordEntries > 0
      ? count(
          basis.recordEntries,
          'client record entry',
          'client record entries',
        )
      : null,
    basis.usesGeneralKnowledge
      ? 'Includes AI general-knowledge reasoning'
      : null,
  ].filter((item): item is string => Boolean(item));
  return [
    { text: `Basis: ${MODE_LABELS[basis.mode]}` },
    { text: counts.join(' · '), style: 'citation' },
    { text: basis.note },
    {
      text: 'This report supports a medical-causation review. It is not a medical diagnosis, and a sequence of events alone does not establish causation.',
      style: 'note',
    },
  ];
}

/** Where a cited item comes from; a PubMed study links to its page. */
function citationBlock(citation: AnalysisCitation): ReportBlock {
  const kind = citation.sourceKind ?? 'knowledge_base';
  const page =
    citation.pageNumber && kind !== 'public_literature'
      ? ` · Page ${citation.pageNumber}`
      : '';
  return {
    text: `${SOURCE_LABELS[kind]} · ${citation.documentName}${page}`,
    style: 'citation',
    ...(kind === 'public_literature' && citation.url
      ? { link: citation.url }
      : {}),
  };
}

function evidenceBlocks(
  items: ClassifiedEvidence[],
  empty: string,
): ReportBlock[] {
  if (items.length === 0) return [{ text: empty, style: 'note' }];
  return items.flatMap((item) => [
    { text: item.excerpt, style: 'item' as const },
    citationBlock(item.citation),
    { text: item.reasoning, style: 'note' as const },
  ]);
}

function alternativeBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const items = result.alternativeExplanations ?? [];
  if (items.length === 0) {
    return [
      { text: 'No alternative explanations were identified.', style: 'note' },
    ];
  }
  return items.flatMap((item) => [
    { text: item.explanation, style: 'subheading' as const },
    {
      text:
        item.basis === 'cited_evidence'
          ? 'Cited evidence'
          : 'AI reasoning (general medical knowledge)',
      style: 'citation' as const,
    },
    ...(item.assessment ? [{ text: item.assessment }] : []),
    ...item.citations.map(citationBlock),
  ]);
}

function chronologyBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const chronology = result.chronology!;
  const blocks: ReportBlock[] = [
    {
      text: `Built from the uploaded records: ${count(chronology.events.length, 'entry', 'entries')} from ${chronology.pagesProcessed} pages. Each entry cites the page it came from. AI extraction can miss or misread details, so check key entries against the source page.`,
      style: 'note',
    },
    ...chronology.documents.map((doc) => ({
      text: [
        doc.documentName,
        count(doc.pageCount, 'page', 'pages'),
        doc.ocrPages?.length
          ? `read with OCR: ${formatPageList(doc.ocrPages)}`
          : null,
        doc.unreadablePages.length > 0
          ? `not read: ${formatPageList(doc.unreadablePages)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      style: 'citation' as const,
    })),
    ...chronology.warnings.map((warning) => ({
      text: warning,
      style: 'note' as const,
    })),
  ];
  if (chronology.events.length === 0) {
    blocks.push({
      text: 'No medical events could be read from the uploaded records.',
      style: 'note',
    });
    return blocks;
  }
  for (const event of chronology.events) blocks.push(...eventBlocks(event));
  return blocks;
}

function eventBlocks(event: ChronologyEvent): ReportBlock[] {
  const where = [event.facility, event.provider].filter(Boolean).join(' · ');
  const bates = event.batesNumbers.length
    ? ` · Bates ${event.batesNumbers.join(', ')}`
    : '';
  const blocks: ReportBlock[] = [
    {
      text: [
        eventDate(event.date),
        EVENT_TYPES[event.type],
        event.citedInAnalysis ? 'Cited in analysis' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      style: 'subheading',
    },
  ];
  if (where) blocks.push({ text: where, style: 'note' });
  blocks.push({ text: event.summary });
  if (event.diagnoses.length > 0) {
    blocks.push({
      text: `Diagnoses: ${event.diagnoses
        .map((dx) =>
          dx.icd10 ? `${dx.description} (${dx.icd10})` : dx.description,
        )
        .join('; ')}`,
    });
  }
  if (event.treatments.length > 0) {
    blocks.push({ text: `Treatment: ${event.treatments.join('; ')}` });
  }
  if (event.medications.length > 0) {
    blocks.push({ text: `Medications: ${event.medications.join('; ')}` });
  }
  if (event.quote) {
    blocks.push({
      text: `“${event.quote}”${event.quoteVerified ? '' : ' — not found on the cited page; check it before relying on it.'}`,
      style: 'citation',
    });
  }
  blocks.push({
    text: `${event.documentName} · p. ${event.pageNumber}${bates}`,
    style: 'citation',
  });
  if (event.ocrConfidence != null) {
    blocks.push({
      text: `Scanned page read with OCR (${event.ocrConfidence}% confidence)${event.ocrConfidence < LOW_OCR_CONFIDENCE ? ' — check this entry against the page.' : '.'}`,
      style: 'note',
    });
  }
  return blocks;
}

function defenseBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const summary = result.defenseIssues!;
  const blocks: ReportBlock[] = [
    {
      text: 'Found by fixed checks of the uploaded records and the intake form, not by AI judgment. Each item quotes its source.',
      style: 'note',
    },
  ];
  if (summary.issues.length === 0) {
    blocks.push({
      text: 'No defense issues were found by these checks.',
      style: 'note',
    });
  }
  for (const issue of summary.issues) {
    blocks.push(
      {
        text: `[${SEVERITY[issue.severity]}] ${issue.title}`,
        style: 'subheading',
      },
      { text: issue.detail },
    );
    for (const item of issue.evidence) {
      const source =
        item.source === 'intake'
          ? 'Intake form'
          : [
              `${item.documentName ?? 'Record'}${item.pageNumber ? ` · p. ${item.pageNumber}` : ''}`,
              item.date ? eventDate(item.date) : null,
              item.chronologyId ?? null,
            ]
              .filter(Boolean)
              .join(' · ');
      blocks.push({ text: `“${item.quote}” — ${source}`, style: 'citation' });
    }
    blocks.push(
      { text: `How the defense may use it: ${issue.defenseArgument}` },
      { text: `What to check or prepare: ${issue.response}` },
    );
  }
  for (const note of summary.notes) blocks.push({ text: note, style: 'note' });
  return blocks;
}

function dateRange(first: string, last: string): string {
  if (!first) return 'Dates not printed';
  return first === last
    ? eventDate(first)
    : `${eventDate(first)} – ${eventDate(last)}`;
}

function specialsBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const specials = result.medicalSpecials!;
  const blocks: ReportBlock[] = [
    {
      text: "Read from the pages that look like bills. Every amount is printed on the cited page, and the totals are added from those lines; a charge printed on two pages counts once. Whether billed or paid amounts are recoverable depends on your state's collateral-source rule.",
      style: 'note',
    },
  ];
  if (specials.status === 'no_bills') {
    blocks.push({
      text: 'No page in the uploaded records looks like a bill. Upload itemized bills (UB-04, CMS-1500, or provider statements) with the records to total the medical expenses.',
      style: 'note',
    });
  } else {
    blocks.push({
      text: `Total billed: ${money.format(specials.totalBilled)} · ${count(specials.providers.length, 'provider', 'providers')}`,
    });
    if (specials.providers.length === 0) {
      blocks.push({
        text: 'Pages that look like bills were read, but no charges were found on them.',
        style: 'note',
      });
    }
    for (const provider of specials.providers) {
      blocks.push(
        {
          text: `${provider.provider} — ${money.format(provider.billed)}`,
          style: 'subheading',
        },
        {
          text: `${dateRange(provider.firstDate, provider.lastDate)} · ${
            provider.billedFrom === 'printed_total'
              ? 'from the total printed on the bill'
              : count(provider.chargeCount, 'charge', 'charges')
          }`,
          style: 'note',
        },
      );
      if (provider.mismatch) {
        blocks.push({
          text: `The lines read add up to ${money.format(provider.mismatch.read)}, but ${provider.mismatch.documentName} p. ${provider.mismatch.pageNumber} prints total charges of ${money.format(provider.mismatch.printed)}. Check the bill for missed lines.`,
          style: 'note',
        });
      }
      for (const charge of specials.charges.filter(
        (item) => item.provider === provider.provider,
      )) {
        blocks.push({
          text:
            [
              charge.dateOfService ? eventDate(charge.dateOfService) : '—',
              `${charge.description}${charge.code ? ` (${charge.code})` : ''}`,
              money.format(charge.amount),
              `${charge.documentName} p. ${charge.pageNumber}`,
            ].join(' · ') +
            (charge.duplicateOf
              ? ` — printed again; counted once (${charge.duplicateOf})`
              : '') +
            (charge.quoteVerified
              ? ''
              : ' — line not matched exactly; check the page'),
          style: 'citation',
        });
      }
      for (const total of provider.printedTotals) {
        blocks.push({
          text: `Printed on the bill — ${PRINTED_LABEL[total.kind]}: ${money.format(total.amount)} · ${total.documentName} p. ${total.pageNumber}`,
          style: 'citation',
        });
      }
    }
    if (specials.billPages.length > 0) {
      blocks.push({
        text: `Bill pages read: ${specials.billPages
          .map(
            (entry) =>
              `${entry.documentName} p. ${formatPageList(entry.pages)}`,
          )
          .join('; ')}`,
        style: 'note',
      });
    }
  }
  if (specials.unbilledProviders.length > 0) {
    blocks.push(
      { text: 'Treatment with no bill in the records', style: 'heading' },
      {
        text: 'These providers appear in the chronology, but no bill with a matching name was found. Request itemized bills from them. Names are matched by their distinctive words, so check the list.',
        style: 'note',
      },
      ...specials.unbilledProviders.map((provider) => ({
        text: `${provider.provider} — ${dateRange(provider.firstDate, provider.lastDate)} · ${count(provider.visits, 'entry', 'entries')} (${provider.chronologyIds.join(', ')})`,
      })),
    );
  }
  for (const warning of specials.warnings) {
    blocks.push({ text: warning, style: 'note' });
  }
  return blocks;
}

function literatureBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const search = result.literatureSearch;
  const blocks: ReportBlock[] = [];
  if (!search) {
    blocks.push({
      text: 'These example references come from an earlier demo version and are not real citations. Run the analysis again to search PubMed.',
      style: 'note',
    });
  } else if (search.status === 'unavailable') {
    blocks.push({
      text:
        search.message ??
        'The public literature search was unavailable for this analysis.',
      style: 'note',
    });
  } else if (search.status === 'disabled') {
    blocks.push({
      text: 'Public literature search is turned off for this site.',
      style: 'note',
    });
  } else {
    blocks.push({
      text: [
        'Peer-reviewed studies from PubMed on this causation question, ranked by relevance.',
        literatureUseNote(result),
        'Read each study before citing it.',
        search.status === 'no_results' && search.message
          ? search.message
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      style: 'note',
    });
  }
  if (search && search.queries.length > 0) {
    blocks.push({
      text: `Searched PubMed for: ${search.queries.join('; ')}`,
      style: 'citation',
    });
    blocks.push({
      text:
        search.queryMethod === 'ai'
          ? 'Search terms written by AI from the diagnosis and question.'
          : 'Search terms built from the diagnosis keywords.',
      style: 'citation',
    });
  }
  result.publicReferences.forEach((reference, index) => {
    blocks.push({
      text: `[${index + 1}] ${reference.title}`,
      style: 'subheading',
    });
    const kind = [
      search ? reference.publicationType : 'Demo reference',
      reference.year ? String(reference.year) : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (kind) blocks.push({ text: kind, style: 'note' });
    if (reference.authors || reference.journal) {
      blocks.push({
        text: [reference.authors, reference.journal]
          .filter(Boolean)
          .join(' · '),
        style: 'citation',
      });
    }
    if (reference.excerpt) {
      blocks.push({
        text: search
          ? `From the abstract: ${reference.excerpt}`
          : reference.excerpt,
      });
    }
    if (reference.pmid) {
      blocks.push({
        text: `PMID ${reference.pmid}${reference.doi ? ` · DOI ${reference.doi}` : ''}`,
        style: 'citation',
      });
    }
    if (search) {
      blocks.push({
        text: `PubMed: ${reference.url}`,
        link: reference.url,
        style: 'citation',
      });
      if (reference.doi) {
        const doi = `https://doi.org/${reference.doi}`;
        blocks.push({
          text: `Publisher (DOI): ${doi}`,
          link: doi,
          style: 'citation',
        });
      }
      if (reference.fullTextUrl) {
        blocks.push({
          text: `Free full text: ${reference.fullTextUrl}`,
          link: reference.fullTextUrl,
          style: 'citation',
        });
      }
    }
  });
  return blocks;
}

/**
 * Whether the listed studies were given to the AI. With little library
 * material the analysis is supplemented with these abstracts as citable
 * sources; otherwise they are listed for review only.
 */
export function literatureUseNote(result: MedicalAnalysisResult): string {
  return (result.evidenceBasis?.literatureArticles ?? 0) > 0
    ? 'Their abstracts were given to the AI as citable sources; evidence cited from them is marked PubMed.'
    : 'They were found for your review and were not used by the AI analysis, which relied on the firm library.';
}

function libraryBlocks(result: MedicalAnalysisResult): ReportBlock[] {
  const blocks: ReportBlock[] = [
    {
      text: "Evidence retrieved from your firm's indexed medical library, including AMA guides, textbooks, and uploaded reference documents.",
    },
    ...result.researchSources.private.map((source) => ({
      text: `${source.name} — ${source.description} (${count(source.count, 'source', 'sources')} used)`,
      style: 'citation' as const,
    })),
  ];
  if (result.privateReferences.length === 0) {
    blocks.push({
      text: 'No knowledge-base passages were cited.',
      style: 'note',
    });
  }
  for (const ref of result.privateReferences) {
    blocks.push({
      text: `${ref.documentName}${ref.pageNumber ? ` · Page ${ref.pageNumber}` : ''}`,
      style: 'subheading',
    });
    const label = [
      ref.classification ? CLASSIFICATION_LABEL[ref.classification] : null,
      typeof ref.relevanceScore === 'number'
        ? `${(ref.relevanceScore * 100).toFixed(0)}% match`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (label) blocks.push({ text: label, style: 'note' });
    blocks.push({
      text:
        ref.summary?.trim() ||
        `Passage from "${ref.documentName}" (${ref.pageNumber ? `page ${ref.pageNumber}` : 'indexed content'}) cited in this causation analysis.`,
    });
    if (ref.excerpt) {
      blocks.push({ text: `“${ref.excerpt}”`, style: 'citation' });
    }
  }
  return blocks;
}

/** Paragraphs of a text, split at blank lines. */
function paragraphs(text: string): ReportBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ text: part }));
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** "2024-08-14" -> "Aug 14, 2024"; partial dates stay partial. */
export function eventDate(date: string): string {
  if (!date) return 'Date not stated';
  const [year, month, day] = date.split('-').map(Number);
  if (!year) return date;
  if (day) {
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
    );
  }
  if (month) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return String(year);
}
