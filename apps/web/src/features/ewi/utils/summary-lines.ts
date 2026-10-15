/**
 * One line per source category that returned nothing, as saved summaries
 * carry them: "Could not verify web. web_search did not return a usable
 * record. Nothing was inferred." The Sources tab lists each source once.
 * Mirrors apps/api/.../analysis/summary-lines.ts.
 */
const SOURCE_GAP_LINE = /^Could not verify [a-z0-9_]+\. /i;

const OLD_NO_RECORDS_LINE =
  "No research items were collected. The information could not be verified.";

export const NO_RECORDS_LINE =
  "No records about this expert were found in the sources searched. The source list shows what was checked.";

/** The investigation summary without its per-source gap lines. */
export function presentableSummaryLines(
  summary: string | null | undefined,
  missing: ReadonlyArray<{ note: string }> = [],
): string[] {
  const gapNotes = new Set(missing.map((item) => item.note.trim()));
  return (summary ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !gapNotes.has(line) && !SOURCE_GAP_LINE.test(line))
    .map((line) => (line === OLD_NO_RECORDS_LINE ? NO_RECORDS_LINE : line));
}

/**
 * Analysis sections worth a card: those backed by collected findings.
 * Sections with nothing collected only restated that sources were empty.
 */
export function sectionsWithFindings<
  T extends { section: string; findingKeys?: string[] },
>(sections: ReadonlyArray<T> | undefined): T[] {
  return (sections ?? []).filter(
    (section) =>
      section.section !== "missing_unverified" &&
      (section.findingKeys?.length ?? 0) > 0,
  );
}
