"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { AdmissibilityChallenges } from "@/components/ewi/admissibility-challenges";
import { ExpertIdentityCard } from "@/components/ewi/expert-identity-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  EwiEvidenceItem,
  EwiInvestigationResult,
  EwiPresenceRecord,
  EwiProfessionalRecord,
  EwiSourceStatus,
} from "@/features/ewi/types";

const CREDENTIAL_CATEGORIES = new Set([
  "education",
  "degree",
  "license",
  "state_license",
  "board_certification",
  "board",
  "profile",
  "cv",
]);

const PUBLICATION_CATEGORIES = new Set([
  "publication",
  "authorship",
  "journal",
]);

const SOURCE_LABELS: Record<string, string> = {
  npi_registry: "NPI Registry",
  open_payments: "CMS Open Payments",
  openalex: "OpenAlex",
  courtlistener: "CourtListener",
  criminal_records: "Criminal background",
  constitutional_sheriff: "Constitutional Sheriff movement",
  post_records: "Peace Officer Standards and Training",
  oath_keepers: "Oath Keepers",
};

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
        item.assessment === "restricted" ||
        item.assessment === "unavailable" ||
        item.assessment === "restricted_unavailable"
          ? "unavailable"
          : "ok",
      message: item.note,
      itemCount: 0,
    }),
  );
  return [...collected, ...gaps];
}

function labelText(label: string | undefined): string {
  switch (label) {
    case "verified":
      return "Verified";
    case "partially_verified":
      return "Partially Verified";
    case "conflicting":
      return "Conflicting";
    case "not_verified":
    case "unverified":
      return "Not Verified";
    case "not_found":
      return "Not Found";
    case "unavailable":
      return "Unavailable";
    case "restricted":
    case "restricted_unavailable":
      return "Restricted";
    case "unable_to_verify":
      return "Unable to Verify";
    default:
      return "Not Verified";
  }
}

function sourceStatusLabel(source: EwiSourceStatus): string {
  if (source.checked === false) {
    if (source.attemptStatus === "skipped") {
      return "Skipped (not a completed check)";
    }
    return "Not checked";
  }
  if (
    source.attemptStatus === "restricted" ||
    source.disposition === "paid_access"
  ) {
    return "Restricted / paid access";
  }
  if (source.disposition === "manual_action") return "Manual action required";
  if (
    source.attemptStatus === "unavailable" ||
    source.status === "unavailable"
  ) {
    return "Unavailable";
  }
  if (source.attemptStatus === "failed" || source.status === "error") {
    return "Failed";
  }
  if (source.status === "unavailable" || source.status === "skipped") {
    return "Unavailable";
  }
  if (source.itemCount === 0) return "Checked — no results";
  return "Checked";
}

/** The Open Payments totals record, shown ahead of the per-company records. */
function isOpenPaymentsTotals(record: EwiProfessionalRecord): boolean {
  return (
    record.kind === "open_payments" &&
    record.title.startsWith("CMS Open Payments ")
  );
}

function filterEvidence(
  evidence: EwiEvidenceItem[],
  categories: Set<string>,
): EwiEvidenceItem[] {
  return evidence.filter((item) =>
    categories.has(item.category.toLowerCase()),
  );
}

export function InvestigationResults(props: {
  summary: string | null;
  result: EwiInvestigationResult | null;
  reportSlot?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <ExpertIdentityCard identity={props.result?.identity} />
      <InvestigationResultTabs {...props} />
    </div>
  );
}

function InvestigationResultTabs({
  summary,
  result,
  reportSlot,
}: {
  summary: string | null;
  result: EwiInvestigationResult | null;
  reportSlot?: ReactNode;
}) {
  const evidence = result?.evidence ?? [];
  const discrepancies = result?.discrepancies ?? [];
  const questions = result?.questions ?? [];
  const legal = result?.legalResearch;
  const presence = result?.onlinePresence;
  const professional = result?.professionalBackground;
  const sources = sourcesFromResult(result);
  const credentials = filterEvidence(evidence, CREDENTIAL_CATEGORIES);
  const publications = filterEvidence(evidence, PUBLICATION_CATEGORIES);
  const unavailable = sources.filter(
    (source) =>
      source.status === "unavailable" ||
      source.status === "error" ||
      source.status === "skipped" ||
      source.attemptStatus === "unavailable" ||
      source.attemptStatus === "restricted" ||
      source.attemptStatus === "failed",
  );

  const challenges = legal?.challenges ?? [];
  const financial = professional?.financial ?? [];
  const paymentTotals = financial.find(isOpenPaymentsTotals);
  const otherFinancial = financial.filter(
    (record) => !isOpenPaymentsTotals(record),
  );

  return (
    <Tabs defaultValue="findings" className="w-full">
      <TabsList aria-label="Investigation result sections">
        <TabsTrigger value="findings">Findings</TabsTrigger>
        <TabsTrigger value="inconsistencies">
          Inconsistencies
          {discrepancies.length > 0 ? ` (${discrepancies.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="legal">Legal Research</TabsTrigger>
        <TabsTrigger value="publications">Publications</TabsTrigger>
        <TabsTrigger value="credentials">Credentials</TabsTrigger>
        <TabsTrigger value="presence">Online Presence</TabsTrigger>
        <TabsTrigger value="income">Income/Bias</TabsTrigger>
        <TabsTrigger value="questions">
          Questions
          {questions.length > 0 ? ` (${questions.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="report">Report</TabsTrigger>
      </TabsList>

      <TabsContent value="findings">
        <ResultPanel title="Investigation findings">
          {summary ? (
            <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">
              {summary}
            </p>
          ) : (
            <EmptyCopy>
              No narrative summary was stored for this investigation.
            </EmptyCopy>
          )}
          {result?.analysis?.document?.sectionSummaries &&
          result.analysis.document.sectionSummaries.length > 0 ? (
            <ul className="mb-4 space-y-3 text-sm">
              {result.analysis.document.sectionSummaries.map((section) => (
                <li
                  key={section.section}
                  className="rounded-lg border border-border p-3"
                >
                  <p className="font-medium">
                    {section.section.replace(/_/g, " ")}{" "}
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {labelText(section.status)}
                    </Badge>
                  </p>
                  <p className="mt-1 text-muted-foreground">{section.text}</p>
                  {section.sourceRefs.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Refs: {section.sourceRefs.slice(0, 8).join(", ")}
                      {section.sourceRefs.length > 8 ? "…" : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
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
          {result?.disclaimer ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {result.disclaimer}
            </p>
          ) : null}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="inconsistencies">
        <ResultPanel title="Potential inconsistencies">
          {discrepancies.length === 0 ? (
            <EmptyCopy>
              No inconsistency was identified in the collected statements.
            </EmptyCopy>
          ) : (
            <ul className="space-y-4">
              {discrepancies.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        item.severity === "high"
                          ? "destructive"
                          : item.severity === "medium"
                            ? "secondary"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {item.severity}
                    </Badge>
                    <p className="font-medium">{item.title}</p>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {labelText(item.label)}
                    {item.field ? ` · ${item.field.replaceAll("_", " ")}` : ""}
                  </p>
                  {item.cvDate || item.cvSource ? (
                    <p className="mt-1">
                      CV:{" "}
                      {[item.cvDate, item.cvSource].filter(Boolean).join(" — ")}
                    </p>
                  ) : null}
                  {item.previousValue ? (
                    <p className="mt-1">Previous value: {item.previousValue}</p>
                  ) : null}
                  {item.currentValue ? (
                    <p>Current value: {item.currentValue}</p>
                  ) : null}
                  {item.change ? <p>Change: {item.change}</p> : null}
                  {item.supportingSource ? (
                    <p>Supporting source: {item.supportingSource}</p>
                  ) : null}
                  <p className="mt-2 text-muted-foreground">
                    {item.description}
                  </p>
                  {item.sources && item.sources.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {item.sources.map((source) => (
                        <li key={`${source.sourceId}-${source.value}`}>
                          {source.url ? (
                            <ExternalLink href={source.url}>
                              {source.sourceName}: {source.value}
                            </ExternalLink>
                          ) : (
                            <span>
                              {source.sourceName}: {source.value}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : item.relatedUrls.length > 0 ? (
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
        </ResultPanel>
      </TabsContent>

      <TabsContent value="legal">
        <ResultPanel title="Legal research">
          {!legal || legal.matters.length === 0 ? (
            <EmptyCopy>
              No legal matter was collected. Nothing was inferred.
            </EmptyCopy>
          ) : (
            <div className="space-y-6 text-sm">
              {challenges.length > 0 ? (
                <ExpandableGroup
                  title="Daubert / Frye challenges"
                  empty=""
                  count={challenges.length}
                >
                  <AdmissibilityChallenges records={challenges} />
                </ExpandableGroup>
              ) : null}
              <ExpandableGroup
                title="Orders"
                empty="No orders were located."
                count={legal.orders.length}
              >
                <ul className="space-y-3">
                  {legal.orders.map((order) => (
                    <li key={order.matter.id}>
                      <p className="font-medium">{order.matter.title}</p>
                      <p className="text-muted-foreground">
                        {[order.sortDate, order.significanceTags.join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {order.matter.findingsRegardingExpert ? (
                        <p className="mt-1">
                          {order.matter.findingsRegardingExpert}
                        </p>
                      ) : null}
                      {order.matter.restricted ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          Restricted
                        </Badge>
                      ) : null}
                      {order.matter.sourceUrl ? (
                        <ExternalLink href={order.matter.sourceUrl} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ExpandableGroup>
              <ExpandableGroup
                title="Motions and pleadings"
                empty="No motions or pleadings were located."
                count={legal.motionsAndPleadings.length}
              >
                <ul className="space-y-3">
                  {legal.motionsAndPleadings.map((filing) => (
                    <li key={filing.matter.id}>
                      <p className="font-medium">{filing.matter.title}</p>
                      <p className="text-muted-foreground">
                        {[filing.sortDate, filing.description]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </ExpandableGroup>
              <ExpandableGroup
                title="Depositions"
                empty="No depositions were located."
                count={legal.depositions.length}
              >
                <ul className="space-y-3">
                  {legal.depositions.map((deposition) => (
                    <li key={deposition.matter.id}>
                      <p className="font-medium">{deposition.matter.title}</p>
                      <p className="text-muted-foreground">
                        {[deposition.caseName, deposition.date]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {deposition.transcriptMetadata ? (
                        <p>Transcript: {deposition.transcriptMetadata}</p>
                      ) : null}
                      {deposition.importantStatements.map((statement) => (
                        <p key={statement} className="mt-1">
                          {statement}
                        </p>
                      ))}
                      {deposition.sourceLink ? (
                        <ExternalLink href={deposition.sourceLink} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ExpandableGroup>
              {legal.testimonyContradictions.length > 0 ? (
                <div>
                  <p className="font-medium">Contradictory testimony</p>
                  <ul className="mt-2 space-y-2">
                    {legal.testimonyContradictions.map((entry) => (
                      <li key={entry.id} className="text-muted-foreground">
                        {entry.description}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="publications">
        <ResultPanel title="Publications">
          {publications.length === 0 ? (
            <EmptyCopy>
              No publication records were collected for this expert.
            </EmptyCopy>
          ) : (
            <ul className="space-y-4">
              {publications.map((item) => (
                <li key={`${item.sourceId}-${item.title}`} className="text-sm">
                  <FindingItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="credentials">
        <ResultPanel title="Credentials">
          {credentials.length === 0 ? (
            <EmptyCopy>
              No education, license, or board certification records were
              collected.
            </EmptyCopy>
          ) : (
            <ul className="space-y-4">
              {credentials.map((item) => (
                <li key={`${item.sourceId}-${item.title}`} className="text-sm">
                  <FindingItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="presence">
        <ResultPanel title="Online presence">
          {!presence || presence.records.length === 0 ? (
            <EmptyCopy>
              No public online presence record was collected. Nothing was
              inferred.
            </EmptyCopy>
          ) : (
            <div className="space-y-4 text-sm">
              <PresenceGroup
                title="Websites and locations"
                records={[
                  ...presence.websites,
                  ...presence.otherPublicSites,
                  ...presence.locations,
                  ...presence.patientReviews,
                ]}
              />
              <PresenceGroup
                title="Directories"
                records={presence.directories}
              />
              <PresenceGroup title="IME" records={presence.ime} />
              <PresenceGroup
                title="Videos and presentations"
                records={presence.videos}
              />
              <PresenceGroup title="Social media" records={presence.social} />
              <PresenceGroup
                title="News and blogs"
                records={presence.newsAndBlogs}
              />
            </div>
          )}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="income">
        <ResultPanel title="Income and bias indicators">
          {financial.length === 0 ? (
            <EmptyCopy>
              No public financial or bias-related records were collected.
              Nothing was inferred.
            </EmptyCopy>
          ) : (
            <div className="space-y-4 text-sm">
              {paymentTotals ? (
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">{paymentTotals.title}</p>
                  {paymentTotals.summary ? (
                    <p className="mt-1 text-muted-foreground">
                      {paymentTotals.summary}
                    </p>
                  ) : null}
                  {paymentTotals.sourceUrl ? (
                    <p className="mt-2">
                      <ExternalLink href={paymentTotals.sourceUrl}>
                        Open Payments profile
                      </ExternalLink>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <ProfessionalGroup
                title={
                  paymentTotals
                    ? "Payments by company"
                    : "Public financial information"
                }
                records={otherFinancial}
              />
            </div>
          )}
          {professional &&
          (professional.corporateAffiliations.length > 0 ||
            professional.organizations.length > 0) ? (
            <div className="mt-6 space-y-4 text-sm">
              <ProfessionalGroup
                title="Corporate affiliations"
                records={professional.corporateAffiliations}
              />
              <ProfessionalGroup
                title="Professional organizations"
                records={professional.organizations}
              />
            </div>
          ) : null}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="questions">
        <ResultPanel
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
            <ol className="max-h-[40rem] list-decimal space-y-3 overflow-y-auto pl-5 text-sm">
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
        </ResultPanel>
      </TabsContent>

      <TabsContent value="sources">
        <ResultPanel title="Sources researched">
          {unavailable.length > 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {unavailable.length} source
              {unavailable.length === 1 ? " was" : "s were"} unavailable,
              restricted, or returned an error. The investigation continued with
              the sources that responded.
            </p>
          ) : null}
          {sources.length === 0 ? (
            <EmptyCopy>No source statuses were recorded.</EmptyCopy>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Items</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr
                      key={source.sourceId}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {SOURCE_LABELS[source.sourceId] ?? source.sourceId}
                      </td>
                      <td className="py-2 pr-3">
                        {sourceStatusLabel(source)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {source.itemCount}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {source.message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResultPanel>
      </TabsContent>

      <TabsContent value="report">
        <ResultPanel title="Final Word report">
          {reportSlot ? (
            reportSlot
          ) : (
            <EmptyCopy>
              Use Download Word Report from the investigation header when a
              report file is available.
            </EmptyCopy>
          )}
        </ResultPanel>
      </TabsContent>
    </Tabs>
  );
}

function ExpandableGroup({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) {
    return (
      <div>
        <p className="font-medium">{title}</p>
        <EmptyCopy>{empty}</EmptyCopy>
      </div>
    );
  }
  return (
    <details open className="group rounded-lg border border-border">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <Badge variant="secondary">{count}</Badge>
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

function ProfessionalGroup({
  title,
  records,
}: {
  title: string;
  records: EwiProfessionalRecord[];
}) {
  if (records.length === 0) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-3">
        {records.map((record) => (
          <li key={record.id}>
            <p className="font-medium">{record.title}</p>
            <p className="text-muted-foreground">
              {[
                record.kind,
                record.identifier,
                record.organization,
                record.institution,
                record.paymentDate,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {record.summary ? (
              <p className="mt-1 text-muted-foreground">{record.summary}</p>
            ) : null}
            {record.resultsUnavailableReason ? (
              <p className="mt-1 text-muted-foreground">
                {record.resultsUnavailableReason}
              </p>
            ) : null}
            {record.verificationNote ? (
              <p className="mt-1 text-muted-foreground">
                {record.verificationNote}
              </p>
            ) : null}
            {record.sourceUrl ? (
              <p className="mt-1">
                <ExternalLink href={record.sourceUrl} />
              </p>
            ) : null}
            {record.resultUrl ? (
              <p className="mt-1">
                <ExternalLink href={record.resultUrl} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PresenceGroup({
  title,
  records,
}: {
  title: string;
  records: EwiPresenceRecord[];
}) {
  if (records.length === 0) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-3">
        {records.map((record) => (
          <li key={record.id}>
            <p className="font-medium">{record.title}</p>
            <p className="text-muted-foreground">
              {[record.kind, record.platform, record.sourceName]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {record.summary ? (
              <p className="mt-1 text-muted-foreground">{record.summary}</p>
            ) : null}
            {record.transcriptUnavailableReason ? (
              <p className="mt-1 text-muted-foreground">
                {record.transcriptUnavailableReason}
              </p>
            ) : null}
            {record.locationNote ? (
              <p className="mt-1 text-muted-foreground">{record.locationNote}</p>
            ) : null}
            {record.neutralSummary && record.kind === "patient_review" ? (
              <p className="mt-1 text-muted-foreground">
                {record.neutralSummary} No medical or legal conclusion is drawn
                from the review.
              </p>
            ) : null}
            {record.restricted ? (
              <Badge variant="outline" className="mt-1 text-[10px]">
                Restricted
              </Badge>
            ) : null}
            {record.url ? (
              <p className="mt-1">
                <ExternalLink href={record.url} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
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

function ResultPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) {
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
