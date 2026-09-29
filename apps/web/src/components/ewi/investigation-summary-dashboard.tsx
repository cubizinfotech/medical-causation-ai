"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  EwiHistoryDetail,
  EwiInvestigationResult,
  EwiJobStatus,
} from "@/features/ewi/types";
import { formatReportDate } from "@/utils/format-date";

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function InvestigationSummaryDashboard({
  expertName,
  city,
  specialty,
  status,
  startedAt,
  completedAt,
  result,
  reportFileName,
  progress,
}: {
  expertName: string;
  city?: string | null;
  specialty: string;
  status: EwiJobStatus;
  startedAt: string;
  completedAt?: string | null;
  result: EwiInvestigationResult | null;
  reportFileName?: string | null;
  progress?: number;
}) {
  const sources = result?.sourceStatuses ?? [];
  const verifiedFromAnalysis =
    result?.analysis?.document?.investigationFindings?.filter(
      (item) => item.status === "verified",
    ).length ?? 0;
  const verifiedFromEvidence = (result?.evidence ?? []).filter((item) =>
    /verified/i.test(item.summary ?? ""),
  ).length;
  const verifiedCount = Math.max(verifiedFromAnalysis, verifiedFromEvidence);

  const inconsistencies = result?.discrepancies?.length ?? 0;
  const unavailable = sources.filter(
    (source) =>
      source.status === "unavailable" ||
      source.attemptStatus === "unavailable" ||
      source.attemptStatus === "restricted" ||
      source.status === "error",
  ).length;
  const questions =
    result?.questionCount ?? result?.questions?.length ?? 0;
  const researched = sources.filter(
    (source) => source.checked !== false && source.attemptStatus !== "skipped",
  ).length;

  const reportStatus = reportFileName
    ? "Ready"
    : status === "completed"
      ? "Unavailable"
      : status === "failed" || status === "cancelled"
        ? "Not generated"
        : "Pending";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{expertName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {[city, specialty].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Badge
            variant={
              status === "completed"
                ? "default"
                : status === "failed" || status === "cancelled"
                  ? "destructive"
                  : "secondary"
            }
            className="capitalize"
          >
            {status}
            {typeof progress === "number" &&
            (status === "pending" || status === "running")
              ? ` · ${progress}%`
              : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Started: </span>
            {formatReportDate(startedAt)}
          </p>
          <p>
            <span className="text-muted-foreground">Completed: </span>
            {completedAt ? formatReportDate(completedAt) : "—"}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sources researched" value={researched} />
          <Metric label="Verified findings" value={verifiedCount} />
          <Metric label="Potential inconsistencies" value={inconsistencies} />
          <Metric label="Unavailable / restricted" value={unavailable} />
          <Metric label="Questions generated" value={questions} />
          <Metric label="Report status" value={reportStatus} />
          <Metric
            label="Evidence items"
            value={result?.evidence?.length ?? 0}
          />
          <Metric
            label="Legal matters"
            value={result?.legalResearch?.matters?.length ?? 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function summaryFromHistory(detail: EwiHistoryDetail) {
  return {
    expertName: detail.expertName,
    city: detail.city,
    specialty: detail.specialty,
    status: detail.status,
    startedAt: detail.createdAt,
    completedAt: detail.completedAt,
    result: detail.result,
    reportFileName: detail.reportFileName,
    progress: detail.progress,
  };
}
