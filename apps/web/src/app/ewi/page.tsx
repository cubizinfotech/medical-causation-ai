"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileSearch,
  ClipboardList,
  History,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import { toUserFacingError } from "@/features/ewi/utils/user-facing-error";
import { formatReportDate } from "@/utils/format-date";

const WORKFLOW = [
  "Enter expert name, city, and specialty",
  "Automated research across credentials, legal, and public sources",
  "Review findings, inconsistencies, and questions",
  "Download the Word report for case prep",
] as const;

export default function EwiDashboardPage() {
  const histories = useQuery({
    queryKey: ewiKeys.histories,
    queryFn: () => ewiClient.listHistories(),
    staleTime: 30_000,
  });

  const recent = (histories.data ?? []).slice(0, 5);
  const inProgress = (histories.data ?? []).filter(
    (row) => row.status === "pending" || row.status === "running",
  );

  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/20 to-background">
      <PageContainer className="py-10 sm:py-14">
        <div className="mb-10 max-w-3xl">
          <Badge variant="secondary" className="mb-3">
            Expert Witness Investigation
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Investigation Dashboard
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Research an opposing expert&apos;s credentials, publications, legal
            history, and public footprint — then generate a Microsoft Word
            report with evidence-based cross-examination questions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/ewi/intake">
                New Investigation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/ewi/histories">
                <History className="h-4 w-4" />
                All Histories
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={<FileSearch className="h-5 w-5" />}
            label="Investigations"
            value={
              histories.isPending
                ? "—"
                : String(histories.data?.length ?? 0)
            }
          />
          <MetricCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="In progress"
            value={histories.isPending ? "—" : String(inProgress.length)}
          />
          <MetricCard
            icon={<Scale className="h-5 w-5" />}
            label="Completed"
            value={
              histories.isPending
                ? "—"
                : String(
                    (histories.data ?? []).filter(
                      (row) => row.status === "completed",
                    ).length,
                  )
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {WORKFLOW.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Recent investigations</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/ewi/histories">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {histories.isPending ? (
                <div className="space-y-3" aria-busy="true" aria-label="Loading">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : null}

              {histories.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load recent work</AlertTitle>
                  <AlertDescription>
                    {toUserFacingError(
                      histories.error,
                      "Could not load investigation history.",
                    )}
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void histories.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              {histories.isSuccess && recent.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No investigations yet. Start with an expert name, city, and
                    specialty.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/ewi/intake">Start Investigation</Link>
                  </Button>
                </div>
              ) : null}

              {histories.isSuccess && recent.length > 0 ? (
                <ul className="divide-y divide-border">
                  {recent.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/ewi/histories/${row.id}`}
                        className="flex flex-col gap-1 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {row.expertName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[row.city, row.specialty]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-sm">
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
                          </Badge>
                          <span className="hidden text-muted-foreground sm:inline">
                            {formatReportDate(row.createdAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
