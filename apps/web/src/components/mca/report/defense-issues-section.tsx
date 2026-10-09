import { Info, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  DefenseIssue,
  DefenseIssuesSummary,
} from "@/features/mca/medical-analysis/types";
import { formatEventDate } from "@/features/mca/records/format";
import { RecordPageLink } from "@/components/mca/report/record-page-link";

const SEVERITY: Record<
  DefenseIssue["severity"],
  { label: string; variant: "destructive" | "secondary" | "outline" }
> = {
  high: { label: "High", variant: "destructive" },
  medium: { label: "Medium", variant: "secondary" },
  low: { label: "Low", variant: "outline" },
};

function IssueItem({ issue }: { issue: DefenseIssue }) {
  return (
    <li className="space-y-3 rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY[issue.severity].variant}>
          {SEVERITY[issue.severity].label}
        </Badge>
        <p className="font-semibold text-foreground">{issue.title}</p>
      </div>
      <p className="text-muted-foreground">{issue.detail}</p>

      {issue.evidence.length > 0 ? (
        <ul className="space-y-2">
          {issue.evidence.map((item, index) => (
            <li
              key={`${item.recordId ?? "intake"}-${item.pageNumber ?? 0}-${index}`}
              className="rounded-md bg-muted/40 px-3 py-2 text-xs"
            >
              <p className="flex gap-1.5 italic text-muted-foreground">
                <Quote className="mt-0.5 h-3 w-3 shrink-0 not-italic" aria-hidden />
                <span>{item.quote}</span>
              </p>
              <p className="mt-1">
                {item.source === "intake" ? (
                  <span className="text-muted-foreground">Intake form</span>
                ) : item.recordId && item.pageNumber ? (
                  <RecordPageLink
                    recordId={item.recordId}
                    pageNumber={item.pageNumber}
                  >
                    {item.documentName ?? "Record"} · p. {item.pageNumber}
                    {item.date ? ` · ${formatEventDate(item.date)}` : ""}
                    {item.chronologyId ? ` · ${item.chronologyId}` : ""}
                  </RecordPageLink>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <p className="text-xs text-muted-foreground">
          <span className="block font-medium text-foreground">
            How the defense may use it
          </span>
          {issue.defenseArgument}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="block font-medium text-foreground">
            What to check or prepare
          </span>
          {issue.response}
        </p>
      </div>
    </li>
  );
}

/**
 * Facts in the client's own records that the defense is likely to raise:
 * late or interrupted treatment, earlier problems, degenerative findings.
 * Found by fixed rules; every item quotes its source.
 */
export function DefenseIssuesSection({
  summary,
}: {
  summary: DefenseIssuesSummary;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Found by fixed checks of the uploaded records and the intake form, not
        by AI judgment. Each item quotes its source; open the page to read it in
        context.
      </p>

      {summary.issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No defense issues were found by these checks.
        </p>
      ) : (
        <ul className="space-y-3">
          {summary.issues.map((issue) => (
            <IssueItem key={issue.id} issue={issue} />
          ))}
        </ul>
      )}

      {summary.notes.length > 0 ? (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {summary.notes.map((note) => (
            <li key={note} className="flex gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
