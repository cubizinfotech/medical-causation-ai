"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPageList } from "@/features/common/format";
import { ewiClient } from "@/features/ewi/ewi.service";
import type {
  EwiCvCheck,
  EwiCvComparison,
  EwiCvLabel,
} from "@/features/ewi/types";
import { cn } from "@/utils/cn";

/** Same words and order as the Word report: conflicts first. */
const LABEL_TEXT: Record<EwiCvLabel, string> = {
  conflicting: "Conflicts",
  not_found: "Not found",
  not_verified: "Not verified",
  partially_verified: "Partly verified",
  verified: "Verified",
  unable_to_verify: "Not checked",
};

const LABEL_ORDER: EwiCvLabel[] = [
  "conflicting",
  "not_found",
  "not_verified",
  "partially_verified",
  "verified",
  "unable_to_verify",
];

const CATEGORY_TEXT: Record<string, string> = {
  specialty: "Specialty",
  board_certification: "Board certification",
  license: "License",
  education: "Education",
  training: "Training",
  appointment: "Appointment",
  publications_count: "Publication count",
  publication: "Publication",
  membership: "Membership",
  award: "Award",
  expert_witness: "Expert witness work",
  industry_relationship: "Industry relationship",
};

function LabelBadge({ label }: { label: EwiCvLabel }) {
  if (label === "conflicting") {
    return <Badge variant="destructive">{LABEL_TEXT[label]}</Badge>;
  }
  if (label === "not_found") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 text-amber-800 dark:text-amber-200"
      >
        {LABEL_TEXT[label]}
      </Badge>
    );
  }
  return (
    <Badge
      variant={
        label === "verified"
          ? "default"
          : label === "partially_verified"
            ? "secondary"
            : "outline"
      }
    >
      {LABEL_TEXT[label]}
    </Badge>
  );
}

/** Opens the uploaded CV at a page in a new tab. */
function CvPageLink({
  documentId,
  page,
  children,
}: {
  documentId: string;
  page: number;
  children: ReactNode;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <button
        type="button"
        disabled={opening}
        onClick={() => {
          setError(null);
          setOpening(true);
          ewiClient
            .openDocumentPage(documentId, page)
            .catch((err: unknown) =>
              setError(
                err instanceof Error ? err.message : "Could not open the CV.",
              ),
            )
            .finally(() => setOpening(false));
        }}
        className="inline-flex items-center gap-1 text-left text-primary hover:underline disabled:opacity-60"
        title="Open this page of the CV"
      >
        {children}
        {opening ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <ExternalLink className="h-3 w-3" aria-hidden />
        )}
      </button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </span>
  );
}

function ComparisonRow({
  row,
  documentId,
}: {
  row: EwiCvComparison;
  documentId: string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        row.label === "conflicting"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <LabelBadge label={row.label} />
        {row.severity === "high" &&
        (row.label === "conflicting" || row.label === "not_found") ? (
          <Badge variant="outline">High priority</Badge>
        ) : null}
        <p className="font-medium">{row.title}</p>
      </div>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            The CV says
          </dt>
          <dd className="mt-0.5">
            {row.cv ? (
              <>
                {row.cv.quote ? `“${row.cv.quote}”` : row.cv.statement}
                {row.cv.page ? (
                  <>
                    {" "}
                    <CvPageLink documentId={documentId} page={row.cv.page}>
                      page {row.cv.page}
                    </CvPageLink>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">
                Not mentioned in the CV.
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.source ? row.source.name : "Public sources"}
          </dt>
          <dd className="mt-0.5">
            {row.source ? (
              <>
                {row.source.statement}
                {row.source.url ? (
                  <>
                    {" "}
                    <a
                      href={row.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Open source
                    </a>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">
                No connected source covers this.
              </span>
            )}
          </dd>
        </div>
      </dl>
      {row.note ? (
        <p className="mt-2 text-xs text-muted-foreground">{row.note}</p>
      ) : null}
    </li>
  );
}

/**
 * What the uploaded CV claims, set against the public sources. Each claim
 * quotes the CV and links to its page; nothing is labeled a conflict unless
 * a source shows something different.
 */
export function CvCheckPanel({ check }: { check?: EwiCvCheck | null }) {
  if (!check) {
    return (
      <p className="text-sm text-muted-foreground">
        No CV was uploaded for this investigation. Add the expert&apos;s CV
        when you start an investigation to check what it claims against the
        public sources.
      </p>
    );
  }

  const { document } = check;
  const groups = LABEL_ORDER.map((label) => ({
    label,
    rows: check.comparisons.filter((row) => row.label === label),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{document.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {document.pageCount} {document.pageCount === 1 ? "page" : "pages"}{" "}
            · {check.claims.length}{" "}
            {check.claims.length === 1 ? "claim" : "claims"} read
            {document.ocrPages.length > 0
              ? ` · pages ${formatPageList(document.ocrPages)} read with OCR`
              : ""}
            {document.unreadablePages.length > 0
              ? ` · pages ${formatPageList(document.unreadablePages)} could not be read`
              : ""}
          </p>
        </div>
        <CvPageLink documentId={document.id} page={1}>
          Open CV
        </CvPageLink>
      </div>

      {check.status !== "completed" || check.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-900 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {check.status === "failed"
              ? "The CV could not be read."
              : check.status === "partial"
                ? "Only part of the CV was read."
                : "Notes on reading the CV"}
          </p>
          {check.warnings.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-6">
              {check.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No claim from the CV could be compared with a public source.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Each claim is set against what a public source shows. Not checked
            means no connected source covers it; confirm those by hand.
          </p>
          <p className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <Badge key={group.label} variant="outline">
                {LABEL_TEXT[group.label]}: {group.rows.length}
              </Badge>
            ))}
          </p>
          {groups.map((group) => (
            <section key={group.label} aria-label={LABEL_TEXT[group.label]}>
              <h3 className="font-medium">
                {LABEL_TEXT[group.label]} ({group.rows.length})
              </h3>
              <ul className="mt-2 space-y-3">
                {group.rows.map((row) => (
                  <ComparisonRow
                    key={row.id}
                    row={row}
                    documentId={document.id}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {check.claims.length > 0 ? (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 font-medium">
            Everything read from the CV ({check.claims.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {check.claims.map((claim) => (
              <li key={claim.id} className="px-4 py-2.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_TEXT[claim.category] ?? claim.category}
                </p>
                <p className="mt-0.5">{claim.statement}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  “{claim.quote}”{" "}
                  <CvPageLink documentId={document.id} page={claim.page}>
                    page {claim.page}
                  </CvPageLink>
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
