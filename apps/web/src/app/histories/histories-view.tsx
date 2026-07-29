"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  medicalAnalysisClient,
} from "@/features/medical-analysis/medical-analysis.service";
import type { AnalysisHistoryListItem } from "@/features/medical-analysis/history.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusVariant(
  status: AnalysisHistoryListItem["status"],
): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
      return "outline";
    case "running":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: AnalysisHistoryListItem["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

export default function HistoriesView() {
  const [histories, setHistories] = useState<AnalysisHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await medicalAnalysisClient.listHistories();
      setHistories(rows);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load histories";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading histories…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (histories.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">No cases submitted yet.</p>
          <Button asChild className="mt-4">
            <Link href="/case">Start a Case</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Cases run one at a time in the background. Additional submissions stay
        queued until the current analysis finishes.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <div className="col-span-3">Patient</div>
          <div className="col-span-4">Medical Question</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-1 text-right">Progress</div>
        </div>

        {histories.map((row) => (
          <Link
            key={row.id}
            href={`/histories/${row.id}`}
            className="block border-b border-border last:border-b-0 transition-colors hover:bg-muted/30"
          >
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-12 sm:items-center sm:gap-4">
              <div className="sm:col-span-3">
                <p className="font-medium text-foreground">{row.patientName}</p>
                <p className="text-xs text-muted-foreground sm:hidden">
                  {formatDate(row.createdAt)}
                </p>
              </div>
              <div className="sm:col-span-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {row.medicalQuestion}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Badge variant={statusVariant(row.status)}>
                  {statusLabel(row.status)}
                </Badge>
                {row.stepLabel &&
                (row.status === "running" || row.status === "queued") ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {row.stepLabel}
                  </p>
                ) : null}
              </div>
              <div className="hidden text-sm text-muted-foreground sm:col-span-2 sm:block">
                {formatDate(row.createdAt)}
              </div>
              <div className="sm:col-span-1">
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-xs text-muted-foreground sm:hidden">
                    {row.progress}%
                  </span>
                  <div className="hidden w-16 sm:block">
                    <Progress value={row.progress} className="h-1.5" />
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {row.progress}%
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
