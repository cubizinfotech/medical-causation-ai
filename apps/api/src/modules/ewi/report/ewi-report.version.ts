export const EWI_REPORT_TEMPLATE_ID = 'ewi/investigation-report';
/**
 * Bump on any wording or layout change: a saved report made with an older
 * version is rebuilt from the stored investigation when it is downloaded.
 * 3.0.0: the report is a PDF laid out like the MCA report (was Word), so
 * Word reports saved before it are replaced by a PDF on their next download.
 * 3.1.0: "not verified" is no longer printed on every finding, question,
 * and source (see report-wording.ts).
 * 3.2.0: global web research section with same-name candidates, optional
 * city, additional context, sourced and labelled cross-examination questions.
 * 3.3.0: web findings are filed under the sections they belong to (degrees,
 * board certification, memberships, orders, corporate ties and so on), each
 * with its source, quote and who stands behind it; credential claims are
 * compared with the issuing body; a section with no finding says what was
 * searched and what limited the search instead of one generic line.
 * 3.4.0: attorney-facing copy — professional empty sections, natural finding
 * prose with hyperlinks, no search-log dump in section 39; Gemini answers
 * are treated as leads and verified before they appear.
 * 3.4.1: a public photo of the expert is shown on the cover when a sourced
 * page published one.
 */
export const EWI_REPORT_TEMPLATE_VERSION = '3.4.1';

export const EWI_REPORT_DISCLAIMER =
  'This document is an investigative research compilation prepared for attorney review. It repeats collected source statements and source-derived analysis only. It is not a certification of any credential, not a legal opinion, and not a substitute for independent attorney review of primary sources. Restricted or unavailable sources are identified as such; their content was not inferred. LexisNexis and other licensed PDFs are not stored unless legally permitted.';
