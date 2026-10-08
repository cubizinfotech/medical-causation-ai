"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { openRecordPage } from "@/features/mca/records/case-records.service";

/** Opens an uploaded record at the cited page in a new tab. */
export function RecordPageLink({
  recordId,
  pageNumber,
  children,
}: {
  recordId: string;
  pageNumber: number;
  children: React.ReactNode;
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
          openRecordPage(recordId, pageNumber)
            .catch((err: unknown) =>
              setError(
                err instanceof Error ? err.message : "Could not open the record.",
              ),
            )
            .finally(() => setOpening(false));
        }}
        className="inline-flex items-center gap-1 text-left text-primary hover:underline disabled:opacity-60"
        title="Open this page of the record"
      >
        {children}
        {opening ? (
          <Loader2 className="no-print h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <ExternalLink className="no-print h-3 w-3" aria-hidden />
        )}
      </button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </span>
  );
}
