"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout";
import { ewiClient } from "@/features/ewi/ewi.service";
import type { EwiHistoryListItem } from "@/features/ewi/types";
import { formatReportDate } from "@/utils/format-date";

export default function EwiHistoriesView() {
  const [rows, setRows] = useState<EwiHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await ewiClient.listHistories());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load histories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            EWI Histories
          </h1>
          <p className="mt-1 text-muted-foreground">
            Past expert witness investigations and Word reports.
          </p>
        </div>
        <Button asChild>
          <Link href="/ewi/intake">New Investigation</Link>
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No investigations yet.</p>
          <Button asChild className="mt-4">
            <Link href="/ewi/intake">Start Investigation</Link>
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/ewi/histories/${row.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.expertName}</p>
                  <p className="text-sm text-muted-foreground">{row.specialty}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="capitalize">{row.status}</p>
                  <p>{formatReportDate(row.createdAt)}</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
