import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MedicalAnalysisResult } from "@/features/mca/medical-analysis/types";
import { MedicalReport } from "./medical-report";

// The PDF export draws the page in a browser; it is not needed to render.
jest.mock("@/features/mca/report/report-export", () => ({
  downloadReportPdf: jest.fn(),
}));

const pubmedCitation = {
  chunkId: "pmid-31234567",
  documentName: "Stroke risk after traumatic brain injury",
  pageNumber: null,
  chunkNumber: 0,
  similarityScore: 0,
  citationText: "[PubMed PMID 31234567]",
  sourceFile: "https://pubmed.ncbi.nlm.nih.gov/31234567/",
  sourceKind: "public_literature" as const,
  url: "https://pubmed.ncbi.nlm.nih.gov/31234567/",
};

function result(
  overrides: Partial<MedicalAnalysisResult> = {},
): MedicalAnalysisResult {
  return {
    executiveSummary: "Summary of the analysis.",
    patientSummary: "47-year-old man.",
    medicalQuestion: "Did the collision contribute to the stroke?",
    retrievedEvidence: [],
    supportingEvidence: [
      {
        type: "supporting",
        excerpt: "TBI was associated with a higher stroke risk.",
        reasoning: "Population evidence of an association.",
        citation: pubmedCitation,
      },
    ],
    opposingEvidence: [],
    neutralEvidence: [],
    aiReasoning: "Reasoning text.",
    confidenceScore: { score: 39, explanation: "Capped.", disclaimer: "Not a diagnosis." },
    limitations: ["Limitation one."],
    conclusion: "Conclusion text.",
    citations: [pubmedCitation],
    causationOpinion: "Opinion text.",
    timelineEvents: [],
    riskFactors: [],
    publicReferences: [],
    privateReferences: [],
    crossExamination: [],
    researchSources: { private: [], public: [] },
    legalDisclaimer: "Disclaimer.",
    metadata: {
      retrievalExecutionTimeMs: 1,
      analysisExecutionTimeMs: 1,
      llmProvider: "gemini",
      llmModel: "gemini-3.5-flash-lite",
      chunkCount: 0,
      generatedAt: "2026-10-14T13:40:00.000Z",
    },
    ...overrides,
  };
}

describe("MedicalReport", () => {
  it("shows what the analysis rests on and labels uncited AI reasoning", () => {
    const html = renderToStaticMarkup(
      createElement(MedicalReport, {
        result: result({
          evidenceBasis: {
            mode: "general_knowledge",
            knowledgeBasePassages: 0,
            relevantKnowledgeBasePassages: 0,
            literatureArticles: 0,
            recordEntries: 0,
            usesGeneralKnowledge: true,
            note: "The firm's medical library had no passages that closely match this question.",
          },
          alternativeExplanations: [
            {
              explanation: "Hypertension",
              assessment: "A major independent risk factor.",
              basis: "general_knowledge",
              citations: [],
            },
            {
              explanation: "Traumatic dissection",
              assessment: "Supported by the cited study.",
              basis: "cited_evidence",
              citations: [pubmedCitation],
            },
          ],
          generalMedicalKnowledge: ["Hypertension raises stroke risk."],
        }),
      }),
    );

    expect(html).toContain("Evidence Basis");
    expect(html).toContain("AI reasoning only — no cited source");
    expect(html).toContain("no passages that closely match");
    expect(html).toContain("Alternative Explanations");
    expect(html).toContain("AI reasoning (general medical knowledge)");
    expect(html).toContain("Cited evidence");
    expect(html).toContain("Uncited AI Reasoning");
    expect(html).toContain("Hypertension raises stroke risk.");
    // PubMed evidence is labelled and links to the study.
    expect(html).toContain("PubMed");
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/31234567/"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("still renders a report saved before these sections existed", () => {
    const html = renderToStaticMarkup(
      createElement(MedicalReport, { result: result() }),
    );
    expect(html).toContain("Medical Causation Opinion");
    expect(html).not.toContain("Evidence Basis");
    expect(html).not.toContain("Alternative Explanations");
    expect(html).not.toContain("Uncited AI Reasoning");
  });

  it("offers the Word export only for a saved case", () => {
    const saved = renderToStaticMarkup(
      createElement(MedicalReport, { result: result(), caseId: "case-1" }),
    );
    const unsaved = renderToStaticMarkup(
      createElement(MedicalReport, { result: result() }),
    );

    expect(saved).toContain("Export PDF");
    expect(saved).toContain("Export Word");
    expect(unsaved).toContain("Export PDF");
    expect(unsaved).not.toContain("Export Word");
  });

  it("says whether the listed PubMed studies were given to the AI", () => {
    const search = {
      status: "completed" as const,
      provider: "PubMed" as const,
      queries: ["traumatic brain injury stroke"],
      queryMethod: "ai" as const,
      abstractsAvailable: true,
      searchedAt: "2026-10-14T13:40:00.000Z",
    };
    const basis = {
      mode: "knowledge_base_and_literature" as const,
      knowledgeBasePassages: 2,
      relevantKnowledgeBasePassages: 1,
      literatureArticles: 3,
      recordEntries: 0,
      usesGeneralKnowledge: false,
      note: "Supplemented with PubMed abstracts.",
    };
    const supplemented = renderToStaticMarkup(
      createElement(MedicalReport, {
        result: result({ literatureSearch: search, evidenceBasis: basis }),
      }),
    );
    const libraryOnly = renderToStaticMarkup(
      createElement(MedicalReport, {
        result: result({
          literatureSearch: search,
          evidenceBasis: { ...basis, mode: "knowledge_base", literatureArticles: 0 },
        }),
      }),
    );

    expect(supplemented).toContain("were given to the AI as citable sources");
    expect(supplemented).not.toContain("were not used by the AI analysis");
    expect(libraryOnly).toContain("were not used by the AI analysis above");
  });
});
