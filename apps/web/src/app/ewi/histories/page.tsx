"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import { toUserFacingError } from "@/features/ewi/utils/user-facing-error";
import { formatReportDate } from "@/utils/format-date";

export default function EwiHistoriesView() {
  const histories = useQuery({
    queryKey: ewiKeys.histories,
    queryFn: () => ewiClient.listHistories(),
    staleTime: 15_000,
  });

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/ewi" className="hover:underline">
              Dashboard
            </Link>
            {" / "}
            Histories
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Investigation Histories
          </h1>
          <p className="mt-1 text-muted-foreground">
            Past expert witness investigations and Word reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void histories.refetch()}
            disabled={histories.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/ewi/intake">New Investigation</Link>
          </Button>
        </div>
      </div>

      {histories.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading histories">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {histories.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load histories</AlertTitle>
          <AlertDescription>
            <p>
              {toUserFacingError(
                histories.error,
                "Failed to load investigation histories.",
              )}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => void histories.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {histories.isSuccess && histories.data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              No investigations yet. Start with an expert name, city, and
              specialty.
            </p>
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
                className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.expertName}</p>
                    <p className="text-sm text-muted-foreground">
                      {[row.city, row.specialty].filter(Boolean).join(" · ")}
                    </p>
                    {row.message ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <Badge
                      variant={
                        row.status === "completed"
                          ? "default"
                          : row.status === "failed" ||
                              row.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {row.status}
                      {row.status === "running" || row.status === "pending"
                        ? ` · ${row.progress}%`
                        : ""}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {formatReportDate(row.createdAt)}
                    </p>
                    {row.reportFileName ? (
                      <p className="text-xs text-muted-foreground">
                        Report ready
                      </p>
                    ) : null}
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
