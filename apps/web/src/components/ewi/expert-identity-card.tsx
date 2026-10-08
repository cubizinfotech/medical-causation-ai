import { AlertTriangle, BadgeCheck, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  EwiIdentityCandidate,
  EwiIdentityResolution,
} from "@/features/ewi/types";

const STATUS_TEXT: Record<EwiIdentityResolution["status"], string> = {
  confirmed: "Identity confirmed in the NPI Registry",
  ambiguous: "Identity not confirmed — more than one possible NPI record",
  not_found: "No matching NPI Registry record",
  npi_mismatch: "The NPI entered belongs to someone else",
  unavailable: "NPI Registry not checked",
};

function place(candidate: EwiIdentityCandidate): string | null {
  if (!candidate.city) return null;
  return [candidate.city, candidate.state].filter(Boolean).join(", ");
}

/**
 * Who the research is about. Payments and other records are attributed to
 * the expert only after this identity is confirmed.
 */
export function ExpertIdentityCard({
  identity,
}: {
  identity: EwiIdentityResolution | null | undefined;
}) {
  if (!identity) return null;
  const confirmed = identity.status === "confirmed";
  const warning =
    identity.status === "ambiguous" || identity.status === "npi_mismatch";
  const Icon = confirmed ? BadgeCheck : warning ? AlertTriangle : HelpCircle;
  const record = identity.identity;

  return (
    <section
      aria-label="Expert identity"
      className={
        warning
          ? "rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5"
          : "rounded-xl border border-border bg-card p-4 sm:p-5"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon
          className={
            confirmed
              ? "h-5 w-5 text-primary"
              : warning
                ? "h-5 w-5 text-amber-600"
                : "h-5 w-5 text-muted-foreground"
          }
          aria-hidden
        />
        <h2 className="text-base font-semibold">
          {STATUS_TEXT[identity.status]}
        </h2>
        {identity.simulated ? (
          <Badge variant="outline" className="text-[10px]">
            Development fixture
          </Badge>
        ) : null}
      </div>

      {record ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">NPI</dt>
            <dd className="font-medium tabular-nums">
              {record.url ? (
                <a
                  href={record.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {record.npi}
                </a>
              ) : (
                record.npi
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Registered name</dt>
            <dd className="font-medium">{record.name}</dd>
          </div>
          {record.taxonomy ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                Primary taxonomy (self-reported)
              </dt>
              <dd>{record.taxonomy}</dd>
            </div>
          ) : null}
          {place(record) ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                Practice location
              </dt>
              <dd>{place(record)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="mt-3 text-sm text-muted-foreground">{identity.note}</p>
      {identity.basis.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Matched on: {identity.basis.join(", ")}
        </p>
      ) : null}
      {identity.notes.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
          {identity.notes.map((note) => (
            <li key={note} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {identity.candidates.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Possible NPI records</p>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
            {identity.candidates.map((candidate) => (
              <li
                key={candidate.npi}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2"
              >
                <span>
                  <span className="font-medium">{candidate.name}</span>
                  <span className="text-muted-foreground">
                    {[candidate.taxonomy, place(candidate)]
                      .filter(Boolean)
                      .map((part) => ` · ${part}`)
                      .join("")}
                  </span>
                </span>
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tabular-nums text-primary underline-offset-2 hover:underline"
                >
                  NPI {candidate.npi}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Payments and other records were not attributed to anyone. To confirm
            the expert, start a new investigation with the correct NPI.
          </p>
        </div>
      ) : null}
    </section>
  );
}
