"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { InvestigationTimeline } from "@/components/ewi/investigation-timeline";
import { InvestigationResults } from "@/components/ewi/investigation-results";
import {
  InvestigationSummaryDashboard,
  summaryFromHistory,
} from "@/components/ewi/investigation-summary-dashboard";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import {
  displayStageLabel,
  resolveStageStatuses,
} from "@/features/ewi/progress-stages";
import {
  clearActiveEwiJob,
  saveExpertForm,
} from "@/features/ewi/storage/ewi-storage";
import { toUserFacingError } from "@/features/ewi/utils/user-facing-error";

export default function EwiHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const history = useQuery({
    queryKey: ewiKeys.history(id),
    queryFn: () => ewiClient.getHistory(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "running") return 4000;
      return false;
    },
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        /401|unauthorized|session/i.test(error.message)
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const remove = useMutation({
    mutationFn: () => ewiClient.deleteHistory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ewiKeys.histories });
      router.push("/ewi/histories");
    },
  });

  const cancel = useMutation({
    mutationFn: () => ewiClient.cancelHistory(id),
    onSuccess: async (detail) => {
      queryClient.setQueryData(ewiKeys.history(id), detail);
      await queryClient.invalidateQueries({ queryKey: ewiKeys.histories });
    },
  });

  if (history.isPending) {
    return (
      <PageContainer className="py-10">
        <div className="space-y-4" aria-busy="true" aria-label="Loading investigation">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (history.isError) {
    return (
      <PageContainer className="py-10">
        <Alert variant="destructive">
          <AlertTitle>Unable to load investigation</AlertTitle>
          <AlertDescription>
            <p>
              {toUserFacingError(
                history.error,
                "Failed to load this investigation.",
              )}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void history.refetch()}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button asChild variant="outline">
                <Link href="/ewi/histories">Back to Histories</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  const detail = history.data;
  const result = detail.result;
  const summary = result?.summary?.trim() || detail.notes;
  const inProgress =
    detail.status === "pending" || detail.status === "running";
  const failed = detail.status === "failed" || detail.status === "cancelled";
  const stageStatuses = resolveStageStatuses({
    currentStep: detail.step,
    jobStatus: detail.status,
    sourceStatuses: result?.sourceStatuses,
  });

  const download = async () => {
    if (!detail.reportFileName) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await ewiClient.downloadReport(detail.id, detail.reportFileName);
    } catch (error) {
      setDownloadError(
        toUserFacingError(
          error,
          "The Word report could not be downloaded. Please retry.",
        ),
      );
    } finally {
      setDownloading(false);
    }
  };

  const retrySameExpert = () => {
    saveExpertForm({
      expertName: detail.expertName,
      city: detail.city || "",
      specialty: detail.specialty,
      npi: detail.npi ?? undefined,
      // The server copies the CV for the new investigation.
      cvDocumentId: detail.cvDocument?.id,
    });
    clearActiveEwiJob();
    router.push("/ewi/investigation");
  };

  const reportSlot = (
    <div className="space-y-3 text-sm">
      {detail.reportFileName ? (
        <>
          <p className="text-muted-foreground">
            Report file: <span className="font-medium">{detail.reportFileName}</span>
          </p>
          <Button onClick={() => void download()} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Downloading…" : "Download Word Report"}
          </Button>
        </>
      ) : detail.status === "completed" ? (
        <EmptyReportNote>
          The investigation completed, but the Word report file is not available
          for download.
        </EmptyReportNote>
      ) : inProgress ? (
        <EmptyReportNote>
          The Word report will be available when report generation finishes.
        </EmptyReportNote>
      ) : (
        <EmptyReportNote>
          No Word report was generated for this investigation.
        </EmptyReportNote>
      )}
      {downloadError ? (
        <Alert variant="destructive">
          <AlertTitle>Download failed</AlertTitle>
          <AlertDescription>
            <p>{downloadError}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => void download()}
            >
              Retry download
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );

  return (
    <PageContainer className="py-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/ewi" className="hover:underline">
              Dashboard
            </Link>
            {" / "}
            <Link href="/ewi/histories" className="hover:underline">
              Histories
            </Link>
            {" / "}
            Investigation
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Investigation Findings
          </h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {detail.reportFileName ? (
            <Button onClick={() => void download()} disabled={downloading}>
              <Download className="h-4 w-4" />
              {downloading ? "Downloading…" : "Download Word Report"}
            </Button>
          ) : null}
          <Button variant="outline" onClick={retrySameExpert}>
            Retry research
          </Button>
          {inProgress ? (
            <Button
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Cancelling…" : "Cancel"}
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
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Delete failed</AlertTitle>
          <AlertDescription>
            {toUserFacingError(
              remove.error,
              "Unable to delete this investigation.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {cancel.isError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Cancel failed</AlertTitle>
          <AlertDescription>
            {toUserFacingError(
              cancel.error,
              "Unable to cancel this investigation.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {downloadError && detail.reportFileName ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Download failed</AlertTitle>
          <AlertDescription>
            <p>{downloadError}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => void download()}
            >
              Retry download
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6">
        <InvestigationSummaryDashboard {...summaryFromHistory(detail)} />
      </div>

      {failed ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {detail.status === "cancelled"
              ? "Investigation cancelled"
              : "Investigation failed"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {toUserFacingError(
                detail.errorMessage,
                "The investigation did not finish.",
              )}
            </p>
            <p className="mt-2 text-muted-foreground">
              You can review any partial findings below, retry the research, or
              start a new investigation.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button onClick={retrySameExpert}>Retry research</Button>
              <Button asChild variant="outline">
                <Link href="/ewi/intake">New investigation</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {inProgress || failed ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Current stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">
                {detail.step
                  ? displayStageLabel(detail.step)
                  : "Waiting to start"}
              </p>
              <p className="text-sm text-muted-foreground">
                {detail.message ??
                  (inProgress
                    ? "Research is still running."
                    : "Stopped before the report was generated.")}
              </p>
              {inProgress ? (
                <Progress
                  value={detail.progress}
                  aria-label="Investigation progress"
                />
              ) : null}
              <p className="text-sm text-muted-foreground">
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
                <InvestigationTimeline statuses={stageStatuses} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {detail.status === "completed" || result ? (
        <InvestigationResults
          summary={summary}
          result={result}
          reportSlot={reportSlot}
        />
      ) : inProgress ? (
        <Alert>
          <AlertTitle>Research in progress</AlertTitle>
          <AlertDescription>
            Findings will appear here as stages complete. This page refreshes
            automatically until the investigation finishes.
          </AlertDescription>
        </Alert>
      ) : null}
    </PageContainer>
  );
}

function EmptyReportNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}
