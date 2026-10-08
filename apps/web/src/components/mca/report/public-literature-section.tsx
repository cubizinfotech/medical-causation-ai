import { AlertTriangle, ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  LiteratureSearchSummary,
  MedicalAnalysisResult,
  PublicReference,
} from "@/features/mca/medical-analysis/types";
import { formatReportDate } from "@/utils/format-date";

const STRONG_EVIDENCE = new Set(["Meta-analysis", "Systematic review"]);
const MODERATE_EVIDENCE = new Set([
  "Guideline",
  "Randomized trial",
  "Observational study",
]);

function pubmedSearchUrl(query: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;
}

function StatusNote({ search }: { search?: LiteratureSearchSummary }) {
  if (!search) {
    return (
      <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          These example references come from an earlier demo version and are
          not real citations. Run the analysis again to search PubMed.
        </p>
      </div>
    );
  }

  if (search.status === "unavailable") {
    return (
      <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          {search.message ??
            "The public literature search was unavailable for this analysis."}
        </p>
      </div>
    );
  }

  if (search.status === "disabled") {
    return (
      <p className="text-sm text-muted-foreground">
        Public literature search is turned off for this site.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Peer-reviewed studies from PubMed on this causation question, ranked by
      relevance. They were found for your review and{" "}
      <span className="font-medium text-foreground">
        were not used by the AI analysis above
      </span>
      , which relies only on the firm library. Read each study before citing
      it.
      {search.status === "no_results" && search.message
        ? ` ${search.message}`
        : null}
    </p>
  );
}

function SearchDetails({ search }: { search: LiteratureSearchSummary }) {
  if (search.queries.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Search className="h-3.5 w-3.5" aria-hidden />
        Searched PubMed for
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {search.queries.map((query) => (
          <li key={query}>
            <a
              href={pubmedSearchUrl(query)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:text-primary"
              title="Open this search on PubMed"
            >
              {query}
              <ExternalLink className="no-print h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {search.queryMethod === "ai"
          ? "Search terms written by AI from the diagnosis and question"
          : "Search terms built from the diagnosis keywords"}{" "}
        · {formatReportDate(search.searchedAt)}
        {!search.abstractsAvailable && search.status === "completed"
          ? " · Abstract excerpts were unavailable"
          : null}
      </p>
    </div>
  );
}

function ReferenceItem({
  reference,
  index,
  legacy,
}: {
  reference: PublicReference;
  index: number;
  legacy: boolean;
}) {
  const type = reference.publicationType;
  return (
    <li className="rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          [{index + 1}]
        </span>
        {legacy ? (
          <Badge variant="outline">Demo reference</Badge>
        ) : type ? (
          <Badge
            variant={
              STRONG_EVIDENCE.has(type)
                ? "default"
                : MODERATE_EVIDENCE.has(type)
                  ? "secondary"
                  : "outline"
            }
          >
            {type}
          </Badge>
        ) : null}
        {reference.year ? (
          <span className="text-xs text-muted-foreground">
            {reference.year}
          </span>
        ) : null}
      </div>

      <p className="mt-2 font-medium leading-snug text-foreground">
        {reference.title}
      </p>
      {reference.authors || reference.journal ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {[reference.authors, reference.journal].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {reference.excerpt ? (
        <p className="mt-2 text-muted-foreground">
          {legacy ? null : (
            <span className="font-medium text-foreground">
              From the abstract:{" "}
            </span>
          )}
          {reference.excerpt}
        </p>
      ) : null}

      {reference.pmid ? (
        <p className="mt-2 text-xs text-muted-foreground">
          PMID {reference.pmid}
          {reference.doi ? ` · DOI ${reference.doi}` : null}
        </p>
      ) : null}

      {legacy ? null : (
        <div className="no-print mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            PubMed <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {reference.doi ? (
            <a
              href={`https://doi.org/${reference.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Publisher (DOI) <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
          {reference.fullTextUrl ? (
            <a
              href={reference.fullTextUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Free full text <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function PublicLiteratureSection({
  result,
}: {
  result: MedicalAnalysisResult;
}) {
  const search = result.literatureSearch;
  const legacy = !search;

  return (
    <div className="space-y-4">
      <StatusNote search={search} />
      {search ? <SearchDetails search={search} /> : null}
      {result.publicReferences.length > 0 ? (
        <ol className="space-y-3">
          {result.publicReferences.map((reference, index) => (
            <ReferenceItem
              key={reference.id}
              reference={reference}
              index={index}
              legacy={legacy}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
