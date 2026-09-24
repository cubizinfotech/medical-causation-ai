import type { ReactNode } from "react";
import type {
  EwiEvidenceItem,
  EwiInvestigationResult,
  EwiSourceStatus,
} from "@/features/ewi/types";

function sourcesFromResult(
  result: EwiInvestigationResult | null,
): EwiSourceStatus[] {
  if (!result) return [];
  if (result.sourceStatuses.length > 0) return result.sourceStatuses;

  const counts = new Map<string, number>();
  for (const item of result.evidence) {
    counts.set(item.sourceId, (counts.get(item.sourceId) ?? 0) + 1);
  }
  const collected: EwiSourceStatus[] = [...counts.entries()].map(
    ([sourceId, itemCount]) => ({
      sourceId,
      status: "ok",
      itemCount,
    }),
  );
  const gaps: EwiSourceStatus[] = (result.analysis?.document?.missing ?? []).map(
    (item) => ({
      sourceId: item.category,
      status:
        item.assessment === "restricted_unavailable" ? "unavailable" : "ok",
      message: item.note,
      itemCount: 0,
    }),
  );
  return [...collected, ...gaps];
}

export function sourceStatusLabel(source: EwiSourceStatus): string {
  if (source.status === "error") return "Error";
  if (source.status === "unavailable" || source.status === "skipped") {
    return "Unavailable";
  }
  if (source.itemCount === 0) return "No results";
  return "Collected";
}

export function InvestigationResults({
  summary,
  result,
}: {
  summary: string | null;
  result: EwiInvestigationResult | null;
}) {
  const evidence = result?.evidence ?? [];
  const discrepancies = result?.discrepancies ?? [];
  const questions = result?.questions ?? [];
  const sources = sourcesFromResult(result);
  const unavailable = sources.filter(
    (source) =>
      source.status === "unavailable" ||
      source.status === "error" ||
      source.status === "skipped",
  );

  return (
    <div className="space-y-6">
      <ResultSection title="Investigation summary">
        {summary ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {summary}
          </p>
        ) : (
          <EmptyCopy>
            The investigation could not verify a qualification from the
            collected sources.
          </EmptyCopy>
        )}
        {result?.disclaimer ? (
          <p className="mt-3 text-xs text-muted-foreground">{result.disclaimer}</p>
        ) : null}
      </ResultSection>

      <ResultSection title="Findings">
        {evidence.length === 0 ? (
          <EmptyCopy>
            No findings were collected. Nothing was inferred from an empty
            source.
          </EmptyCopy>
        ) : (
          <ul className="space-y-4">
            {evidence.map((item) => (
              <li key={`${item.sourceId}-${item.title}`} className="text-sm">
                <FindingItem item={item} />
              </li>
            ))}
          </ul>
        )}
      </ResultSection>

      <ResultSection title="Discrepancies">
        {discrepancies.length === 0 ? (
          <EmptyCopy>
            No conflict between collected statements was identified.
          </EmptyCopy>
        ) : (
          <ul className="space-y-4">
            {discrepancies.map((item) => (
              <li key={item.id} className="text-sm">
                <p className="font-medium capitalize">
                  [{item.severity}] {item.title}
                </p>
                <p className="mt-1 text-muted-foreground">{item.description}</p>
                {item.relatedUrls.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {item.relatedUrls.map((url) => (
                      <li key={url}>
                        <ExternalLink href={url} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ResultSection>

      <ResultSection title="Sources">
        {unavailable.length > 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {unavailable.length} source
            {unavailable.length === 1 ? " was" : "s were"} unavailable or
            returned an error. The investigation continued with the sources that
            responded.
          </p>
        ) : null}
        {sources.length === 0 ? (
          <EmptyCopy>No source statuses were recorded.</EmptyCopy>
        ) : (
          <ul className="space-y-3">
            {sources.map((source) => (
              <li key={source.sourceId} className="text-sm">
                <p className="font-medium">
                  {source.sourceId}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {sourceStatusLabel(source)}
                    {source.itemCount > 0 ? ` · ${source.itemCount} item(s)` : ""}
                  </span>
                </p>
                {source.message ? (
                  <p className="mt-1 text-muted-foreground">{source.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ResultSection>

      <ResultSection
        title={
          questions.length > 0
            ? `Cross-examination questions (${questions.length})`
            : "Cross-examination questions"
        }
      >
        {questions.length === 0 ? (
          <EmptyCopy>
            No cross-examination questions were generated. Facts were not
            invented to fill the list.
          </EmptyCopy>
        ) : (
          <ol className="max-h-[32rem] list-decimal space-y-3 overflow-y-auto pl-5 text-sm">
            {questions.map((question) => (
              <li key={question.number}>
                <span className="font-medium">{question.category}:</span>{" "}
                {question.question}
                <p className="mt-1 text-xs text-muted-foreground">
                  Basis: {question.evidenceBasis}
                </p>
              </li>
            ))}
          </ol>
        )}
      </ResultSection>
    </div>
  );
}

function FindingItem({ item }: { item: EwiEvidenceItem }) {
  return (
    <>
      <p className="font-medium">{item.title}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {item.category} · {item.sourceId}
      </p>
      {item.summary ? (
        <p className="mt-1 text-muted-foreground">{item.summary}</p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          No summary text was stored for this item.
        </p>
      )}
      {item.url ? (
        <p className="mt-1">
          <ExternalLink href={item.url} />
        </p>
      ) : null}
    </>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-primary underline-offset-2 hover:underline"
    >
      {href}
    </a>
  );
}
