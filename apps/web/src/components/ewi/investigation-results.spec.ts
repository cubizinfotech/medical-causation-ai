import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EwiInvestigationResult } from "@/features/ewi/types";
import { InvestigationResults } from "./investigation-results";
import { InvestigationSummaryDashboard } from "./investigation-summary-dashboard";

/** A saved investigation in which every source came back empty. */
const savedSummary = [
  "Investigation of Dr Matthew Cahill (Anesthesiology).",
  "This summary uses collected source statements only. It does not confirm a qualification that those statements do not support.",
  "No research items were collected. The information could not be verified.",
  "Could not verify identity. The searched source returned no record. That is not evidence the expert lacks this qualification.",
  "Could not verify web. web_search did not return a usable record. Nothing was inferred.",
  "Could not verify deposition. depositions requires authorized access. Nothing was inferred.",
].join("\n");

const result = {
  expertName: "Dr Matthew Cahill",
  city: "Altrincham",
  specialty: "Anesthesiology",
  evidence: [],
  discrepancies: [],
  questions: [],
  questionCount: 0,
  sourceStatuses: [],
  summary: savedSummary,
  analysis: {
    origin: "deterministic",
    providerName: null,
    document: {
      summary: savedSummary,
      missing: [
        {
          category: "identity",
          assessment: "not_found",
          note: "Could not verify identity. The searched source returned no record. That is not evidence the expert lacks this qualification.",
        },
      ],
      sectionSummaries: [
        {
          section: "expert_summary",
          text: "No verified identity profile findings were collected for Dr Matthew Cahill. Status: unavailable.",
          status: "unavailable",
          sourceRefs: ["source:npi_registry"],
          findingKeys: [],
        },
        {
          section: "credentials",
          text: "No education, license, or board certification findings were collected. Status: unavailable.",
          status: "unavailable",
          sourceRefs: ["source:state_license"],
          findingKeys: [],
        },
      ],
    },
  },
} as unknown as EwiInvestigationResult;

describe("InvestigationResults findings", () => {
  it("shows no per-source 'could not verify' lines or empty section cards", () => {
    const html = renderToStaticMarkup(
      createElement(InvestigationResults, { summary: savedSummary, result }),
    );

    expect(html).toContain("Investigation of Dr Matthew Cahill (Anesthesiology).");
    expect(html).toContain(
      "No information about this expert was confirmed from the sources retrieved.",
    );
    expect(html).not.toMatch(/Could not verify|Nothing was inferred/);
    expect(html).not.toContain("No verified identity profile findings");
    expect(html).not.toContain("No education, license, or board certification");
  });

  it("shows a sourced expert photo when web research found one", () => {
    const html = renderToStaticMarkup(
      createElement(InvestigationSummaryDashboard, {
        expertName: result.expertName,
        city: result.city,
        specialty: result.specialty,
        status: "completed",
        startedAt: "2026-10-20T00:00:00.000Z",
        completedAt: "2026-10-20T00:10:00.000Z",
        result: {
          ...result,
          webResearch: {
            ranAt: "2026-10-20T00:00:00.000Z",
            durationMs: 1,
            partial: false,
            partialNote: null,
            queriesPlanned: 1,
            queriesRun: 1,
            providers: [],
            pagesRead: 1,
            pagesBlocked: [],
            candidates: [],
            records: [],
            registries: [],
            limitations: [],
            portrait: {
              dataUrl: "data:image/png;base64,aaa",
              mimeType: "image/png",
              sourceUrl: "https://clinic.example/about",
              imageUrl: "https://clinic.example/jason.png",
            },
          },
        },
      }),
    );
    expect(html).toContain("data:image/png;base64,aaa");
    expect(html).toContain("Photo from clinic.example");
  });
});
