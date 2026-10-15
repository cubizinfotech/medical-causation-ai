export const EWI_REPORT_TEMPLATE_ID = 'ewi/investigation-report';
/**
 * Bump on any wording or layout change: a saved report made with an older
 * version is rebuilt from the stored investigation when it is downloaded.
 * 3.0.0: the report is a PDF laid out like the MCA report (was Word), so
 * Word reports saved before it are replaced by a PDF on their next download.
 */
export const EWI_REPORT_TEMPLATE_VERSION = '3.0.0';

export const EWI_REPORT_DISCLAIMER =
  'This document is an investigative research compilation prepared for attorney review. It repeats collected source statements and source-derived analysis only. It is not a certification of any credential, not a legal opinion, and not a substitute for independent attorney review of primary sources. Restricted or unavailable sources are identified as such; their content was not inferred. LexisNexis and other licensed PDFs are not stored unless legally permitted.';
