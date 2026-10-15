import {
  NO_RECORDS_LINE,
  presentableSummaryLines,
  sectionsWithFindings,
} from "./summary-lines";

describe("presentableSummaryLines", () => {
  it("drops per-source gap lines from a saved summary", () => {
    const saved = [
      "Investigation of Dr Matthew Cahill (Anesthesiology).",
      "No research items were collected. The information could not be verified.",
      "Could not verify identity. The searched source returned no record. That is not evidence the expert lacks this qualification.",
      "Could not verify web. web_search did not return a usable record. Nothing was inferred.",
      "Could not verify criminal_record. criminal_records requires authorized access. Nothing was inferred.",
    ].join("\n");

    expect(presentableSummaryLines(saved)).toEqual([
      "Investigation of Dr Matthew Cahill (Anesthesiology).",
      NO_RECORDS_LINE,
    ]);
  });

  it("keeps lines about collected items and handles an empty summary", () => {
    const item =
      'Could not verify "Board certification". The npi_registry statement is not verified.';
    expect(presentableSummaryLines(item)).toEqual([item]);
    expect(presentableSummaryLines(null)).toEqual([]);
  });
});

describe("sectionsWithFindings", () => {
  it("keeps only sections backed by collected findings", () => {
    const sections = [
      { section: "expert_summary", findingKeys: [] },
      { section: "publications", findingKeys: ["f1"] },
      { section: "missing_unverified", findingKeys: ["f2"] },
    ];
    expect(sectionsWithFindings(sections).map((s) => s.section)).toEqual([
      "publications",
    ]);
    expect(sectionsWithFindings(undefined)).toEqual([]);
  });
});
