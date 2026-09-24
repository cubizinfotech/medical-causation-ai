"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { ProgressTimeline } from "@/components/demo";
import { InvestigationResults } from "@/components/ewi/investigation-results";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import {
  EWI_DISPLAY_STAGES,
  displayStageLabel,
  timelineIndex,
} from "@/features/ewi/progress-stages";
import { formatReportDate } from "@/utils/format-date";

export default function EwiHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const history = useQuery({
    queryKey: ewiKeys.history(id),
    queryFn: () => ewiClient.getHistory(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "running") return 4000;
      return false;
    },
  });

  const remove = useMutation({
    mutationFn: () => ewiClient.deleteHistory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ewiKeys.histories });
      router.push("/ewi/histories");
    },
  });

  if (history.isPending) {
    return (
      <PageContainer className="py-10">
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading investigation…
        </div>
      </PageContainer>
    );
  }

  if (history.isError) {
    return (
      <PageContainer className="py-10">
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {history.error instanceof Error
                ? history.error.message
                : "Failed to load investigation"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void history.refetch()}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button asChild variant="outline">
                <Link href="/ewi/histories">Back to Histories</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const detail = history.data;
  const result = detail.result;
  const summary = result?.summary?.trim() || detail.notes;
  const inProgress =
    detail.status === "pending" || detail.status === "running";
  const failed = detail.status === "failed" || detail.status === "cancelled";

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {detail.expertName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {detail.specialty} · <span className="capitalize">{detail.status}</span>
            {inProgress ? ` · ${detail.progress}%` : ""} ·{" "}
            {formatReportDate(detail.createdAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {detail.reportFileName ? (
            <Button
              onClick={() => {
                void ewiClient.downloadReport(detail.id, detail.reportFileName!);
              }}
            >
              Download Word Report
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/ewi/histories">All Histories</Link>
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
        </div>
      </div>

      {remove.isError ? (
        <p className="mb-4 text-sm text-destructive">
          {remove.error instanceof Error
            ? remove.error.message
            : "Unable to delete this investigation."}
        </p>
      ) : null}

      {failed ? (
        <Card className="mb-6 border-destructive/30">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {detail.status === "cancelled"
                    ? "Investigation cancelled"
                    : "Investigation failed"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.errorMessage ?? "The investigation did not finish."}
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/ewi/intake">Start again</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {inProgress || failed ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Current stage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {detail.step ? displayStageLabel(detail.step) : "Waiting to start"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {detail.message ??
                  (inProgress
                    ? "Research is still running."
                    : "Stopped before the report was generated.")}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Overall progress {detail.progress}%
              </p>
            </CardContent>
          </Card>
          <Card className="h-fit lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Investigation stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[32rem] overflow-y-auto pr-1">
                <ProgressTimeline
                  steps={EWI_DISPLAY_STAGES.map((stage) => ({
                    id: stage.id,
                    label: stage.label,
                  }))}
                  currentStepIndex={timelineIndex(detail.step, detail.status)}
                  failed={failed}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {detail.status === "completed" || result ? (
        <InvestigationResults summary={summary} result={result} />
      ) : null}

      {detail.status === "completed" && !detail.reportFileName ? (
        <p className="mt-6 text-sm text-muted-foreground">
          The Word report file is not available for download.
        </p>
      ) : null}
    </PageContainer>
  );
}
