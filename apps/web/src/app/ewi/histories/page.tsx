"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import { formatReportDate } from "@/utils/format-date";

export default function EwiHistoriesView() {
  const histories = useQuery({
    queryKey: ewiKeys.histories,
    queryFn: () => ewiClient.listHistories(),
  });

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EWI Histories</h1>
          <p className="mt-1 text-muted-foreground">
            Past expert witness investigations and Word reports.
          </p>
        </div>
        <Button asChild>
          <Link href="/ewi/intake">New Investigation</Link>
        </Button>
      </div>

      {histories.isPending ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading histories…
        </div>
      ) : null}

      {histories.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {histories.error instanceof Error
                ? histories.error.message
                : "Failed to load histories"}
            </p>
            <Button variant="outline" onClick={() => void histories.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {histories.isSuccess && histories.data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No investigations yet.</p>
            <Button asChild className="mt-4">
              <Link href="/ewi/intake">Start Investigation</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {histories.isSuccess && histories.data.length > 0 ? (
        <ul className="space-y-3">
          {histories.data.map((row) => (
            <li key={row.id}>
              <Link
                href={`/ewi/histories/${row.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{row.expertName}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.specialty}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="capitalize">{row.status}</p>
                    <p>{formatReportDate(row.createdAt)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </PageContainer>
  );
}
