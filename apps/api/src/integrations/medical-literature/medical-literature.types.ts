/** Strength of a study design, used for ranking and report badges. */
export type EvidenceType =
  | 'meta_analysis'
  | 'systematic_review'
  | 'guideline'
  | 'randomized_trial'
  | 'observational'
  | 'review'
  | 'case_report'
  | 'other';

export interface LiteratureArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year?: number;
  publicationTypes: string[];
  evidenceType: EvidenceType;
  doi?: string;
  pmcid?: string;
  /** Conclusion (or opening) sentences of the abstract, plain text. */
  abstractExcerpt?: string;
  /** The search queries that returned this article. */
  matchedQueries: string[];
  pubmedUrl: string;
  /** Free full text in PubMed Central, when available. */
  fullTextUrl?: string;
}

export interface LiteratureSearchRequest {
  /** Short natural-language PubMed queries, most specific first. */
  queries: string[];
  /** Terms naming the injury or exposure, e.g. "traumatic brain injury". */
  exposureTerms: string[];
  /** Terms naming the claimed condition, e.g. "stroke". */
  outcomeTerms: string[];
}

export interface LiteratureSearchResponse {
  articles: LiteratureArticle[];
  /** False when Europe PMC could not supply abstracts (articles still valid). */
  abstractsAvailable: boolean;
  failedQueries: string[];
}

/** Subset of the PubMed esummary record this integration reads. */
export interface PubMedSummary {
  uid: string;
  title: string;
  pubdate?: string;
  source?: string;
  fulljournalname?: string;
  authors?: Array<{ name: string; authtype?: string }>;
  pubtype?: string[];
  articleids?: Array<{ idtype: string; value: string }>;
  attributes?: string[];
  lang?: string[];
}

export interface EuropePmcAbstract {
  abstractHtml: string;
  pmcid?: string;
  isOpenAccess: boolean;
}
