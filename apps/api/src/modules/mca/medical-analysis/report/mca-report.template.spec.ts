import { BadRequestException, NotFoundException } from '@nestjs/common';
import mammoth from 'mammoth';
import { DocxReportRenderer } from '@platform/report/docx/docx-report.renderer';
import type { AnalysisHistoryService } from '../services/analysis-history.service';
import type { AnalysisCitation, MedicalAnalysisResult } from '../types';
import { buildMcaReportDocument, eventDate } from './mca-report.template';
import { McaWordReportService } from './mca-word-report.service';

const libraryCitation: AnalysisCitation = {
  chunkId: 'chunk-1',
  documentName: 'Stroke after TBI review.pdf',
  pageNumber: 12,
  chunkNumber: 3,
  similarityScore: 0.81,
  citationText: 'Stroke after TBI review.pdf, p. 12',
  sourceFile: 'articles/stroke-tbi.pdf',
  sourceKind: 'knowledge_base',
};

const pubmedCitation: AnalysisCitation = {
  chunkId: 'pmid-1',
  documentName: 'TBI and stroke risk cohort',
  pageNumber: null,
  chunkNumber: 0,
  similarityScore: 0.7,
  citationText: 'PMID 123',
  sourceFile: 'pubmed',
  sourceKind: 'public_literature',
  url: 'https://pubmed.ncbi.nlm.nih.gov/123/',
};

function result(
  overrides: Partial<MedicalAnalysisResult> = {},
): MedicalAnalysisResult {
  return {
    executiveSummary: 'The records show a temporal association only.',
    patientSummary: '47-year-old male after a motor vehicle collision.',
    medicalQuestion:
      'Did the collision and mild TBI cause the ischemic stroke five months later?',
    retrievedEvidence: [],
    supportingEvidence: [
      {
        type: 'supporting',
        reasoning: 'Links TBI to later stroke risk.',
        excerpt: 'TBI was associated with a higher stroke risk.',
        citation: pubmedCitation,
      },
    ],
    opposingEvidence: [],
    neutralEvidence: [],
    aiReasoning: 'First paragraph.\n\nSecond paragraph.',
    confidenceScore: {
      score: 34,
      explanation: 'Limited direct evidence.',
      disclaimer: 'Not a probability of causation.',
    },
    limitations: ['Five-month gap between injury and stroke.'],
    conclusion: 'Causation is not established by timing alone.',
    citations: [libraryCitation, pubmedCitation],
    alternativeExplanations: [
      {
        explanation: 'Atrial fibrillation',
        assessment: 'A cardioembolic source was not excluded.',
        basis: 'cited_evidence',
        citations: [libraryCitation],
      },
    ],
    generalMedicalKnowledge: ['Hypertension raises stroke risk.'],
    evidenceBasis: {
      mode: 'knowledge_base_and_literature',
      knowledgeBasePassages: 2,
      relevantKnowledgeBasePassages: 1,
      literatureArticles: 3,
      recordEntries: 0,
      usesGeneralKnowledge: true,
      note: 'The library had few relevant passages; PubMed abstracts were added.',
    },
    metadata: {
      retrievalExecutionTimeMs: 10,
      analysisExecutionTimeMs: 20,
      llmProvider: 'gemini',
      llmModel: 'gemini-3.5-flash-lite',
      chunkCount: 2,
      generatedAt: '2026-10-16T08:00:00.000Z',
    },
    causationOpinion: 'Causation is not established by timing alone.',
    timelineEvents: [
      {
        date: '2024-08-14',
        event: 'Motor vehicle collision',
        significance: 'Mild TBI diagnosed.',
      },
    ],
    riskFactors: [
      {
        factor: 'Hypertension',
        category: 'comorbidity',
        impact: 'Independent stroke risk.',
      },
    ],
    publicReferences: [
      {
        id: 'ref-1',
        title: 'TBI and stroke risk cohort',
        source: 'PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/123/',
        year: 2019,
        pmid: '123',
        doi: '10.1000/xyz',
        publicationType: 'Observational study',
        authors: 'Smith J, Lee K',
        journal: 'Stroke',
        excerpt: 'Risk was higher in the first year.',
      },
    ],
    literatureSearch: {
      status: 'completed',
      provider: 'PubMed',
      queries: ['traumatic brain injury ischemic stroke'],
      queryMethod: 'ai',
      abstractsAvailable: true,
      searchedAt: '2026-10-16T08:00:00.000Z',
    },
    chronology: {
      status: 'completed',
      documents: [
        {
          recordId: 'record-1',
          documentName: 'ER records.pdf',
          pageCount: 4,
          unreadablePages: [4],
          ocrPages: [2, 3],
        },
      ],
      events: [
        {
          id: 'rec-1',
          date: '2024-08-14',
          type: 'emergency',
          facility: 'St. Mary Hospital',
          summary: 'Seen after a rear-end collision; CT head negative.',
          diagnoses: [{ description: 'Concussion', icd10: 'S06.0X0A' }],
          treatments: ['Observation'],
          medications: [],
          recordId: 'record-1',
          documentName: 'ER records.pdf',
          pageNumber: 2,
          batesNumbers: ['ER-0002'],
          quote: 'CT head negative',
          quoteVerified: false,
          citedInAnalysis: true,
          ocrConfidence: 52,
        },
      ],
      pagesProcessed: 4,
      warnings: ['Page 4 could not be read.'],
      generatedAt: '2026-10-16T08:00:00.000Z',
    },
    defenseIssues: {
      status: 'completed',
      issues: [
        {
          id: 'issue-1',
          kind: 'delayed_treatment',
          severity: 'high',
          title: 'Five-month gap before the stroke',
          detail: 'No visit is recorded between August and January.',
          defenseArgument: 'The stroke had another cause.',
          response: 'Collect primary-care records for the gap.',
          evidence: [
            {
              source: 'record',
              recordId: 'record-1',
              documentName: 'ER records.pdf',
              pageNumber: 2,
              date: '2024-08-14',
              chronologyId: 'rec-1',
              quote: 'Discharged home',
            },
          ],
        },
      ],
      notes: ['Checks ran on one record.'],
    },
    medicalSpecials: {
      status: 'completed',
      charges: [
        {
          id: 'chg-1',
          provider: 'St. Mary Hospital',
          dateOfService: '2024-08-14',
          description: 'CT head',
          code: '70450',
          amount: 1200,
          amountText: '$1,200.00',
          recordId: 'record-1',
          documentName: 'ER bill.pdf',
          pageNumber: 1,
          batesNumbers: [],
          quote: 'CT HEAD 70450 1,200.00',
          quoteVerified: true,
        },
      ],
      providers: [
        {
          provider: 'St. Mary Hospital',
          firstDate: '2024-08-14',
          lastDate: '2024-08-14',
          billed: 1200,
          billedFrom: 'charges',
          chargeCount: 1,
          printedTotals: [],
        },
      ],
      totalBilled: 1200,
      billPages: [
        { recordId: 'record-1', documentName: 'ER bill.pdf', pages: [1] },
      ],
      unbilledProviders: [],
      warnings: [],
      generatedAt: '2026-10-16T08:00:00.000Z',
    },
    privateReferences: [
      {
        chunkId: 'chunk-1',
        documentName: 'Stroke after TBI review.pdf',
        pageNumber: 12,
        citationText: 'p. 12',
        summary: 'Review of stroke after head injury.',
        excerpt: 'Stroke risk rises after TBI.',
        classification: 'supporting',
        relevanceScore: 0.81,
        sourceFile: 'articles/stroke-tbi.pdf',
        sourceType: 'private_kb',
      },
    ],
    crossExamination: [
      {
        name: 'Timing',
        questions: [
          {
            question: 'Doctor, five months passed before the stroke, correct?',
            purpose: 'Establishes the gap.',
          },
        ],
      },
    ],
    researchSources: {
      private: [
        { name: 'Firm library', description: 'Indexed articles', count: 1 },
      ],
      public: [],
    },
    legalDisclaimer: 'For attorney research only.',
    ...overrides,
  };
}

const caseDetails = {
  patientAge: '47',
  patientGender: 'male',
  accidentDate: '2024-08-14',
  accidentType: 'Motor vehicle collision',
  diagnosis: 'Mild TBI; ischemic stroke',
  medicalQuestion: 'Fallback question',
};

describe('buildMcaReportDocument', () => {
  it('follows the web report: cover details, summary, highlights, then the sections in order', () => {
    const document = buildMcaReportDocument({ result: result(), caseDetails });

    expect(document.product).toBe('mca');
    expect(document.fileName).toBe('medical-causation-report-2026-10-16.docx');
    expect(document.highlights).toEqual([
      'Confidence: 34/100',
      '1 supporting source',
      '0 opposing sources',
      '1 knowledge-base passage',
      '1 cross-exam question',
    ]);
    const facts = document.sections.filter(
      (section) => section.placement === 'cover-fact',
    );
    expect(facts.map((fact) => [fact.title, fact.blocks[0].text])).toEqual([
      [
        'Medical question',
        'Did the collision and mild TBI cause the ischemic stroke five months later?',
      ],
      ['Patient', 'Age 47 · Male'],
      ['Date of loss', 'Aug 14, 2024'],
      ['Accident type', 'Motor vehicle collision'],
      ['Diagnosis', 'Mild TBI; ischemic stroke'],
      ['AI model', 'gemini / gemini-3.5-flash-lite'],
    ]);
    expect(
      document.sections
        .filter((section) => !section.placement)
        .map((section) => section.title),
    ).toEqual([
      'Evidence Basis',
      'Confidence Score',
      'Medical Causation Opinion',
      'Supporting Evidence',
      'Opposing Evidence',
      'Medical Reasoning',
      'Alternative Explanations',
      'Uncited AI Reasoning',
      'Timeline of Events',
      'Medical Chronology',
      'Defense Issues (Bad Facts)',
      'Medical Bills (Specials)',
      'Risk Factors',
      'Published Medical Literature',
      'Private Knowledge Base Sources',
      'Cross-Examination Questions',
      'Legal Disclaimer',
      'Terms, Conditions & Policy',
    ]);
  });

  it('leaves out the sections an older analysis does not have', () => {
    const document = buildMcaReportDocument({
      result: result({
        evidenceBasis: undefined,
        alternativeExplanations: undefined,
        generalMedicalKnowledge: undefined,
        chronology: undefined,
        defenseIssues: undefined,
        medicalSpecials: undefined,
      }),
      caseDetails,
    });
    const titles = document.sections.map((section) => section.title);

    for (const missing of [
      'Evidence Basis',
      'Alternative Explanations',
      'Uncited AI Reasoning',
      'Medical Chronology',
      'Defense Issues (Bad Facts)',
      'Medical Bills (Specials)',
    ]) {
      expect(titles).not.toContain(missing);
    }
  });

  it('says whether the listed studies were given to the AI', () => {
    const text = (literatureArticles: number) =>
      buildMcaReportDocument({
        result: result({
          evidenceBasis: { ...result().evidenceBasis!, literatureArticles },
        }),
        caseDetails,
      })
        .sections.find((section) => section.id === 'literature')
        ?.blocks.map((block) => block.text)
        .join('\n');

    expect(text(3)).toMatch(/given to the AI as citable sources/);
    expect(text(0)).toMatch(/not used by the AI analysis/);
  });

  it('formats record dates like the web report', () => {
    expect(eventDate('2024-08-14')).toBe('Aug 14, 2024');
    expect(eventDate('2024-08')).toBe('Aug 2024');
    expect(eventDate('2024')).toBe('2024');
    expect(eventDate('')).toBe('Date not stated');
  });
});

describe('McaWordReportService', () => {
  const renderer = new DocxReportRenderer();
  const detail = {
    id: 'case-1',
    status: 'completed',
    result: result(),
    ...caseDetails,
  };
  const service = (getHistory: jest.Mock) =>
    new McaWordReportService(
      { getHistory } as unknown as AnalysisHistoryService,
      renderer,
    );

  it("exports the owner's finished analysis as Word", async () => {
    const getHistory = jest.fn().mockResolvedValue(detail);
    const report = await service(getHistory).build('case-1', 'user-1');
    const { value: text } = await mammoth.extractRawText({
      buffer: report.buffer,
    });
    const { value: html } = await mammoth.convertToHtml({
      buffer: report.buffer,
    });

    expect(getHistory).toHaveBeenCalledWith('case-1', 'user-1');
    expect(report.fileName).toBe('medical-causation-report-2026-10-16.docx');
    expect(report.buffer.subarray(0, 2).toString()).toBe('PK');
    for (const expected of [
      'MEDICAL CAUSATION ANALYSIS REPORT',
      'The records show a temporal association only.',
      'Confidence: 34/100',
      'Evidence alignment score: 34/100',
      'TBI was associated with a higher stroke risk.',
      'PubMed · TBI and stroke risk cohort',
      'Aug 14, 2024 · Emergency visit · Cited in analysis',
      'not found on the cited page',
      'Scanned page read with OCR (52% confidence) — check this entry against the page.',
      '[High] Five-month gap before the stroke',
      'Total billed: $1,200.00 · 1 provider',
      'Aug 14, 2024 · CT head (70450) · $1,200.00 · ER bill.pdf p. 1',
      'Doctor, five months passed before the stroke, correct?',
      'For attorney research only.',
      'No Medical Advice',
    ]) {
      expect(text).toContain(expected);
    }
    expect(html).toContain('<a href="https://pubmed.ncbi.nlm.nih.gov/123/">');
    expect(html).toContain('<a href="https://doi.org/10.1000/xyz">');
  });

  it('refuses an analysis that has not finished', async () => {
    const getHistory = jest
      .fn()
      .mockResolvedValue({ ...detail, status: 'running', result: null });

    await expect(service(getHistory).build('case-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it("does not export another user's analysis", async () => {
    const getHistory = jest
      .fn()
      .mockRejectedValue(new NotFoundException('Analysis history not found'));

    await expect(service(getHistory).build('case-1', 'user-2')).rejects.toThrow(
      NotFoundException,
    );
  });
});
