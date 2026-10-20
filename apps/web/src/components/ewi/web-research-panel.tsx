"use client";

import { Badge } from "@/components/ui/badge";
import type {
  EwiWebCandidate,
  EwiWebMatchLevel,
  EwiWebRecord,
  EwiWebResearchDossier,
} from "@/features/ewi/types";

const KIND_LABELS: Record<string, string> = {
  social: "Social media",
  news: "News",
  blog: "Blog",
  directory: "Directory",
  review: "Review",
  video: "Video",
  presentation: "Presentation",
  court: "Court record",
  justia: "Justia",
  corporate: "Corporate record",
  publication: "Publication",
  university: "University",
  expert_website: "Expert website",
  advertising: "Advertising",
  ime: "IME / expert services",
  maps: "Maps listing",
  profile: "Profile",
  other: "Other",
};

const CLAIM_LABELS: Record<string, string> = {
  advertising: "Advertising claim",
  forensic: "Forensic / expert-work claim",
  credential: "Credential claim",
  allegation: "Allegation (unproven)",
  rating: "Rating",
  other: "Statement",
};

const MATCH_LABELS: Record<EwiWebMatchLevel, string> = {
  strong: "Strong match",
  possible: "Possible match",
  weak: "Weak match",
  other_person: "Different person",
  none: "No match",
};

const READ_LABELS: Record<EwiWebRecord["read"], string> = {
  read: "Page read",
  snippet_only: "Search snippet only",
  restricted: "Restricted",
  failed: "Could not be read",
  not_read: "Not read",
};

function kindLabel(record: EwiWebRecord): string {
  const base = KIND_LABELS[record.kind] ?? record.kind;
  return record.platform ? `${base} · ${record.platform}` : base;
}

function matchVariant(level: EwiWebMatchLevel) {
  if (level === "strong") return "default" as const;
  if (level === "possible") return "secondary" as const;
  return "outline" as const;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function ExternalLink({ href, children }: { href: string; children?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-primary underline-offset-2 hover:underline"
    >
      {children ?? href}
    </a>
  );
}

function RecordItem({ record }: { record: EwiWebRecord }) {
  const published = formatDate(record.publishedAt);
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {kindLabel(record)}
        </Badge>
        <Badge variant={matchVariant(record.match.level)} className="text-[10px]">
          {MATCH_LABELS[record.match.level]}
          {record.match.confidence ? ` (${record.match.confidence})` : ""}
        </Badge>
        {published ? (
          <span className="text-xs text-muted-foreground">
            Published {published}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-medium">
        <ExternalLink href={record.url}>{record.title || record.url}</ExternalLink>
      </p>
      {record.summary ? (
        <p className="mt-1 text-muted-foreground">{record.summary}</p>
      ) : record.snippet ? (
        <p className="mt-1 text-muted-foreground">{record.snippet}</p>
      ) : null}
      {record.match.quote ? (
        <blockquote className="mt-2 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
          &ldquo;{record.match.quote}&rdquo;
          {record.match.quoteVerified ? "" : " (quote not verified on page)"}
        </blockquote>
      ) : null}
      {record.claims.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {record.claims.map((claim) => (
            <li key={`${claim.type}-${claim.text}`} className="text-xs">
              <span className="font-medium">
                {CLAIM_LABELS[claim.type] ?? claim.type}:
              </span>{" "}
              {claim.text}
              {claim.quote ? (
                <span className="block italic text-muted-foreground">
                  &ldquo;{claim.quote}&rdquo;
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {record.match.conflicts.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Differences from the expert: {record.match.conflicts.join("; ")}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {READ_LABELS[record.read]}
        {record.readNote ? ` — ${record.readNote}` : ""}
        {record.archiveUrl ? (
          <>
            {" "}
            · <ExternalLink href={record.archiveUrl}>Archived copy</ExternalLink>
          </>
        ) : null}
      </p>
    </li>
  );
}

function CandidateGroup({
  candidate,
  records,
}: {
  candidate: EwiWebCandidate;
  records: EwiWebRecord[];
}) {
  return (
    <section
      className="rounded-xl border border-border p-4"
      aria-label={candidate.label}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{candidate.label}</h3>
        <Badge variant={candidate.role === "subject" ? "default" : "outline"}>
          {candidate.role === "subject"
            ? "Likely the expert"
            : "Different person with a similar name"}
        </Badge>
        <Badge variant="secondary" className="capitalize">
          {candidate.confidence} confidence
        </Badge>
      </div>
      {candidate.basis.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Matched on: {candidate.basis.join(", ")}
        </p>
      ) : null}
      {candidate.role === "other" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Kept separate. Nothing here is attributed to the expert.
        </p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {records.map((record) => (
          <RecordItem key={record.id} record={record} />
        ))}
      </ul>
    </section>
  );
}

export function WebResearchPanel({
  dossier,
}: {
  dossier: EwiWebResearchDossier | null | undefined;
}) {
  if (!dossier) {
    return (
      <p className="text-sm text-muted-foreground">
        The global web search did not run for this investigation, so nothing from
        news, social media, reviews, advertising, or corporate records was
        collected. This is not a finding that nothing exists.
      </p>
    );
  }

  const byId = new Map(dossier.records.map((record) => [record.id, record]));
  const grouped = new Set<string>();
  const groups = dossier.candidates.map((candidate) => {
    const records = candidate.recordIds
      .map((id) => byId.get(id))
      .filter((record): record is EwiWebRecord => Boolean(record));
    for (const record of records) grouped.add(record.id);
    return { candidate, records };
  });
  const ungrouped = dossier.records.filter((record) => !grouped.has(record.id));
  const kindCounts = new Map<string, number>();
  for (const record of dossier.records) {
    if (record.match.level === "other_person" || record.match.level === "none") {
      continue;
    }
    kindCounts.set(record.kind, (kindCounts.get(record.kind) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 text-sm">
      <p className="text-muted-foreground">
        {dossier.queriesRun} search request
        {dossier.queriesRun === 1 ? " was" : "s were"} sent, and{" "}
        {dossier.pagesRead} page{dossier.pagesRead === 1 ? " was" : "s were"}{" "}
        read in full. {dossier.records.length} web record
        {dossier.records.length === 1 ? "" : "s"} found. Run on{" "}
        {formatDate(dossier.ranAt)}.
      </p>

      {dossier.partial ? (
        <p
          className="rounded-lg border border-border bg-muted/40 p-3"
          role="status"
        >
          {dossier.partialNote ??
            "The web search stopped early, so some sources may be missing."}
        </p>
      ) : null}

      {kindCounts.size > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Records by type">
          {[...kindCounts.entries()].map(([kind, count]) => (
            <Badge key={kind} variant="secondary">
              {KIND_LABELS[kind] ?? kind}: {count}
            </Badge>
          ))}
        </div>
      ) : null}

      {groups.length > 1 ? (
        <p className="rounded-lg border border-border p-3">
          {groups.length} different people share this name in the web results.
          They are listed separately below and were not merged.
        </p>
      ) : null}

      {groups.length === 0 && ungrouped.length === 0 ? (
        <p className="text-muted-foreground">
          No web page was confirmed to concern this expert in the searches that
          ran. This is not proof that nothing exists; see the coverage below.
        </p>
      ) : null}

      <div className="space-y-4">
        {groups.map(({ candidate, records }) => (
          <CandidateGroup
            key={candidate.id}
            candidate={candidate}
            records={records}
          />
        ))}
      </div>

      {ungrouped.length > 0 ? (
        <section>
          <h3 className="font-semibold">Other pages that were found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            These could not be tied to one person.
          </p>
          <ul className="mt-3 space-y-3">
            {ungrouped.map((record) => (
              <RecordItem key={record.id} record={record} />
            ))}
          </ul>
        </section>
      ) : null}

      {(dossier.verifications ?? []).length > 0 ? (
        <section>
          <h3 className="font-semibold">Credentials checked at the source</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A claim is confirmed only by a page from the body that issues it.
          </p>
          <ul className="mt-2 space-y-2">
            {(dossier.verifications ?? []).map((verification) => (
              <li key={verification.id} className="rounded-lg border border-border p-3">
                <span className="font-medium">{verification.claim}</span>
                <Badge
                  variant={
                    verification.status === "confirmed" ? "secondary" : "outline"
                  }
                  className="ml-2"
                >
                  {verification.status === "confirmed"
                    ? "Confirmed at the source"
                    : verification.status === "not_confirmed"
                      ? "Not confirmed at the source"
                      : "Not checked at the source"}
                </Badge>
                <p className="mt-1 text-muted-foreground">{verification.note}</p>
                {verification.confirmedBy ? (
                  <p className="mt-1">
                    <ExternalLink href={verification.confirmedBy.url}>
                      {verification.confirmedBy.name}
                    </ExternalLink>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="font-semibold">Coverage</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Search provider</th>
                <th className="py-2 pr-3 font-medium">Requests</th>
                <th className="py-2 pr-3 font-medium">Hits</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {dossier.providers.map((provider) => (
                <tr key={provider.providerId} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{provider.name}</td>
                  <td className="py-2 pr-3 tabular-nums">{provider.requests}</td>
                  <td className="py-2 pr-3 tabular-nums">{provider.hits}</td>
                  <td className="py-2 text-muted-foreground">
                    {!provider.configured
                      ? "Not configured"
                      : provider.failures.length > 0
                        ? provider.failures
                            .slice(0, 2)
                            .map((failure) => failure.message)
                            .join("; ")
                        : "Completed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dossier.registries.length > 0 ? (
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {dossier.registries.map((registry) => (
              <li key={registry.id}>
                <span className="font-medium text-foreground">
                  {registry.name}:
                </span>{" "}
                {registry.message}
                {registry.url ? (
                  <>
                    {" "}
                    <ExternalLink href={registry.url}>Open</ExternalLink>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {dossier.pagesBlocked.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-muted-foreground">
              {dossier.pagesBlocked.length} page
              {dossier.pagesBlocked.length === 1 ? "" : "s"} could not be read
            </summary>
            <ul className="mt-2 space-y-1">
              {dossier.pagesBlocked.map((page) => (
                <li key={page.url} className="text-muted-foreground">
                  <ExternalLink href={page.url} /> — {page.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {dossier.limitations.length > 0 ? (
        <section>
          <h3 className="font-semibold">Limitations</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {dossier.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
