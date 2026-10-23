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
 * 3.5.0: source coverage distinguishes searched, empty, unimplemented,
 * unconfigured, blocked, and failed providers; catalog title misses are not
 * treated as proven publication inconsistencies; stale stored questions are
 * rebuilt from current evidence on export.
 * 3.5.1: a global web run does not imply every category was searched; empty
 * sections no longer say "did not establish" unless a dedicated source ran;
 * a coverage-summary item is not counted as evidence found.
 * 3.6.0: publication matches use DOI/PMID and citation fields; author
 * position is reported only from a complete source list; unread CV pages
 * are named; a catalog miss is not a confirmed discrepancy.
 * 3.7.0: court opinions are not treated as complete dockets; NPPES licenses
 * are labelled self-reported; official Florida license lookup is separate;
 * blocked pages are not empty searches; topic-level web search is not every
 * directory.
 * 3.8.0: cross-examination questions are generated only from collected
 * evidence, documented inconsistencies, or identified research gaps, each
 * with source citations; ungrounded legacy questions are omitted on export
 * without changing stored investigation rows.
 * 3.9.0: PubMed acknowledgements are not grant awards; author order is taken
 * from collected author lists; court captions stay unresolved instead of
 * “Unnamed case”; coverage summaries are not findings; identifier-only
 * questions are omitted.
 * 3.9.1: docket URL slugs supply missing captions; unofficial pages are not
 * license verification; empty video searches are not reused prior hits;
 * identifier, contact-dump, and repetitive biography questions are dropped.
 * 3.9.2: rebuild re-normalizes captions from stored evidence URLs; truncated
 * docket slugs stay unresolved; stored questions use the same filters as new
 * drafts and can be supplemented with caption-aware legal questions; empty
 * `ok` results are not treated as completed searches; never-sent restricted
 * catalogs are not checked.
 * 3.10.0: deeper public-web search and pagination; YouTube caption flag and
 * capped AssemblyAI transcripts of direct media; first-author/CV table;
 * CourtListener pagination and honest pleadings/orders coverage; 100
 * evidence-based questions with a shortfall explanation.
 * 3.10.1: question shortfall names the extra evidence that would be needed;
 * truncated catalog author lists are “unable to verify,” not first author.
 */
export const EWI_REPORT_TEMPLATE_VERSION = '3.10.1';

export const EWI_REPORT_DISCLAIMER =
  'This document is an investigative research compilation prepared for attorney review. It repeats collected source statements and source-derived analysis only. It is not a certification of any credential, not a legal opinion, and not a substitute for independent attorney review of primary sources. Restricted or unavailable sources are identified as such; their content was not inferred. LexisNexis and other licensed PDFs are not stored unless legally permitted.';
