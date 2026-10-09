"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Quote,
  ScanText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ChronologyEvent,
  ChronologyEventType,
  MedicalChronology,
} from "@/features/mca/medical-analysis/types";
import { formatEventDate, formatPageList } from "@/features/mca/records/format";
import { RecordPageLink } from "@/components/mca/report/record-page-link";
import { cn } from "@/utils/cn";

const TYPE_LABELS: Record<ChronologyEventType, string> = {
  emergency: "Emergency visit",
  office_visit: "Office visit",
  hospital_admission: "Hospital admission",
  imaging: "Imaging",
  lab: "Lab result",
  procedure: "Procedure",
  surgery: "Surgery",
  therapy: "Therapy",
  medication: "Medication",
  other: "Other",
};

/** Matches the server default (MCA_RECORDS_OCR_LOW_CONFIDENCE). */
const LOW_OCR_CONFIDENCE = 60;

function EventItem({ event }: { event: ChronologyEvent }) {
  const where = [event.facility, event.provider].filter(Boolean).join(" · ");
  const bates = event.batesNumbers.length
    ? ` · Bates ${event.batesNumbers.join(", ")}`
    : "";

  return (
    <li className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-[9.5rem_1fr]">
      <div className="space-y-1.5">
        <p className="font-semibold tabular-nums text-foreground">
          {formatEventDate(event.date)}
        </p>
        <Badge variant="secondary">{TYPE_LABELS[event.type]}</Badge>
        {event.citedInAnalysis ? (
          <p className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Cited in analysis
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        {where ? (
          <p className="text-xs font-medium text-muted-foreground">{where}</p>
        ) : null}
        <p className="leading-relaxed text-foreground">{event.summary}</p>

        {event.diagnoses.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {event.diagnoses.map((dx) => (
              <span
                key={`${dx.description}-${dx.icd10 ?? ""}`}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
              >
                {dx.description}
                {dx.icd10 ? (
                  <span className="ml-1 font-mono text-muted-foreground">
                    {dx.icd10}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        {event.treatments.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Treatment: </span>
            {event.treatments.join("; ")}
          </p>
        ) : null}
        {event.medications.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Medications: </span>
            {event.medications.join("; ")}
          </p>
        ) : null}

        {event.quote ? (
          <p
            className={cn(
              "flex gap-1.5 rounded-md px-2.5 py-1.5 text-xs italic",
              event.quoteVerified
                ? "bg-muted/40 text-muted-foreground"
                : "bg-amber-500/10 text-amber-900 dark:text-amber-200",
            )}
          >
            <Quote className="mt-0.5 h-3 w-3 shrink-0 not-italic" aria-hidden />
            <span>
              {event.quote}
              {event.quoteVerified ? null : (
                <span className="not-italic font-medium">
                  {" "}
                  — not found on the cited page; check it before relying on it.
                </span>
              )}
            </span>
          </p>
        ) : null}

        <p className="text-xs">
          <RecordPageLink recordId={event.recordId} pageNumber={event.pageNumber}>
            {event.documentName} · p. {event.pageNumber}
            {bates}
          </RecordPageLink>
        </p>
        {event.ocrConfidence != null ? (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs",
              event.ocrConfidence < LOW_OCR_CONFIDENCE
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground",
            )}
          >
            <ScanText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Scanned page read with OCR ({event.ocrConfidence}% confidence)
            {event.ocrConfidence < LOW_OCR_CONFIDENCE
              ? " — check this entry against the page."
              : "."}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function MedicalChronologySection({
  chronology,
}: {
  chronology: MedicalChronology;
}) {
  const [citedOnly, setCitedOnly] = useState(false);
  const citedCount = chronology.events.filter((e) => e.citedInAnalysis).length;
  const events = citedOnly
    ? chronology.events.filter((e) => e.citedInAnalysis)
    : chronology.events;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Built from the uploaded records: {chronology.events.length}{" "}
        {chronology.events.length === 1 ? "entry" : "entries"} from{" "}
        {chronology.pagesProcessed} pages. Each entry links to the page it came
        from. AI extraction can miss or misread details, so check key entries
        against the source page.
      </p>

      <ul className="flex flex-wrap gap-2">
        {chronology.documents.map((doc) => (
          <li
            key={doc.recordId}
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs"
          >
            <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
            <RecordPageLink recordId={doc.recordId} pageNumber={1}>
              {doc.documentName}
            </RecordPageLink>
            <span className="text-muted-foreground">
              · {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
              {doc.ocrPages && doc.ocrPages.length > 0
                ? ` · read with OCR: ${formatPageList(doc.ocrPages)}`
                : ""}
              {doc.unreadablePages.length > 0
                ? ` · not read: ${formatPageList(doc.unreadablePages)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      {chronology.warnings.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {chronology.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {chronology.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No medical events could be read from the uploaded records.
        </p>
      ) : (
        <>
          {citedCount > 0 ? (
            <label className="no-print flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={citedOnly}
                onChange={(e) => setCitedOnly(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show only the {citedCount}{" "}
              {citedCount === 1 ? "entry" : "entries"} cited in the analysis
            </label>
          ) : null}
          <ol className="space-y-3">
            {events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
