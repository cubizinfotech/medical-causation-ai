"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { medicalAnalysisClient } from "@/features/medical-analysis/medical-analysis.service";
import { formatReportDate } from "@/utils/format-date";
import type { AnalysisHistoryListItem } from "@/features/medical-analysis/history.types";

function formatDate(iso: string): string {
  return formatReportDate(iso);
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
  const [pendingDelete, setPendingDelete] =
    useState<AnalysisHistoryListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      await medicalAnalysisClient.deleteHistory(pendingDelete.id);
      setHistories((rows) =>
        rows.filter((row) => row.id !== pendingDelete.id),
      );
      setPendingDelete(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete history";
      setError(message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

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
    <>
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
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {histories.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-12 sm:items-center sm:gap-4"
            >
              <Link
                href={`/histories/${row.id}`}
                className="contents transition-colors hover:bg-muted/30"
              >
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
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {row.stepLabel}
                    </p>
                  ) : null}
                </div>
                <div className="hidden text-sm text-muted-foreground sm:col-span-2 sm:block">
                  {formatDate(row.createdAt)}
                </div>
                <div className="hidden sm:col-span-1 sm:block">
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={row.progress} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">
                      {row.progress}%
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center justify-between sm:col-span-12 sm:justify-end sm:pl-0">
                <span className="text-xs text-muted-foreground sm:hidden">
                  {row.progress}% complete
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(row)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete case history?"
        description={
          pendingDelete
            ? `This permanently removes the case for ${pendingDelete.patientName} and its analysis report. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete Case"
        destructive
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
