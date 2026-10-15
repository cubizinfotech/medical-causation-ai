/**
 * One line per source category that returned nothing, as older summaries
 * carried them: "Could not verify web. web_search did not return a usable
 * record. Nothing was inferred." The source list shows each source once.
 */
const SOURCE_GAP_LINE = /^Could not verify [a-z0-9_]+\. /i;

const OLD_NO_RECORDS_LINE =
  'No research items were collected. The information could not be verified.';

export const NO_RECORDS_LINE =
  'No records about this expert were found in the sources searched. The source list shows what was checked.';

/**
 * The summary as shown in the app and the PDF report: without the
 * per-source gap lines, and with the empty-result line in plain words.
 * Works on summaries saved before these lines were dropped.
 */
export function presentableSummaryLines(
  summary: string,
  missing: ReadonlyArray<{ note: string }> = [],
): string[] {
  const gapNotes = new Set(missing.map((item) => item.note.trim()));
  return summary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !gapNotes.has(line) && !SOURCE_GAP_LINE.test(line))
    .map((line) => (line === OLD_NO_RECORDS_LINE ? NO_RECORDS_LINE : line));
}
