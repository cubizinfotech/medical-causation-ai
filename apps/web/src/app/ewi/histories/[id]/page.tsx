"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AlertCircle, Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startRouteProgress } from "@/components/layout/route-progress";
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
  const [downloadError, setDownloadError] = useState<{
    message: string;
    format: "pdf" | "word";
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
      startRouteProgress();
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
              <Button
                variant="outline"
                loading={history.isFetching}
                onClick={() => void history.refetch()}
              >
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
      const savedAs = await ewiClient.downloadReport(
        detail.id,
        detail.reportFileName,
      );
      // A Word report saved before the PDF template was just rebuilt as a
      // PDF: refresh the file name shown here.
      if (savedAs !== detail.reportFileName) {
        void queryClient.invalidateQueries({ queryKey: ewiKeys.history(id) });
      }
    } catch (error) {
      setDownloadError({
        message: toUserFacingError(
          error,
          "The PDF report could not be downloaded. Please retry.",
        ),
        format: "pdf",
      });
    } finally {
      setDownloading(false);
    }
  };

  const exportWord = async () => {
    setDownloadError(null);
    setExportingWord(true);
    try {
      await ewiClient.downloadWordReport(
        detail.id,
        (detail.reportFileName || "ewi-report.docx").replace(
          /\.[a-z0-9]+$/i,
          ".docx",
        ),
      );
    } catch (error) {
      setDownloadError({
        message: toUserFacingError(
          error,
          "The Word report could not be exported. Please retry.",
        ),
        format: "word",
      });
    } finally {
      setExportingWord(false);
    }
  };

  const retryDownload = () =>
    void (downloadError?.format === "word" ? exportWord() : download());

  const canExportWord = detail.status === "completed";
  const wordButton = canExportWord ? (
    <Button
      variant="outline"
      onClick={() => void exportWord()}
      loading={exportingWord}
      loadingText="Exporting…"
    >
      <FileText className="h-4 w-4" />
      Export Word
    </Button>
  ) : null;

  const retrySameExpert = () => {
    saveExpertForm({
      expertName: detail.expertName,
      city: detail.city || "",
      specialty: detail.specialty,
      npi: detail.npi ?? undefined,
      additionalContext: detail.additionalContext ?? undefined,
      // The server copies the CV for the new investigation.
      cvDocumentId: detail.cvDocument?.id,
    });
    clearActiveEwiJob();
    setRetrying(true);
    startRouteProgress();
    router.push("/ewi/investigation");
  };

  const reportSlot = (
    <div className="space-y-3 text-sm">
      {detail.reportFileName ? (
        <>
          <p className="text-muted-foreground">
            Report file: <span className="font-medium">{detail.reportFileName}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void download()}
              loading={downloading}
              loadingText="Downloading…"
            >
              <Download className="h-4 w-4" />
              Download PDF Report
            </Button>
            {wordButton}
          </div>
        </>
      ) : detail.status === "completed" ? (
        <>
          <EmptyReportNote>
            The investigation completed, but the PDF report file is not
            available for download.
          </EmptyReportNote>
          {wordButton}
        </>
      ) : inProgress ? (
        <EmptyReportNote>
          The PDF report will be available when report generation finishes.
        </EmptyReportNote>
      ) : (
        <EmptyReportNote>
          No PDF report was generated for this investigation.
        </EmptyReportNote>
      )}
      {downloadError ? (
        <Alert variant="destructive">
          <AlertTitle>Download failed</AlertTitle>
          <AlertDescription>
            <p>{downloadError.message}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              loading={downloading || exportingWord}
              onClick={retryDownload}
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
      {/* Title above the actions, so the buttons keep to one row. */}
      <div className="mb-6 flex flex-col gap-4">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {detail.reportFileName ? (
            <Button
              onClick={() => void download()}
              loading={downloading}
              loadingText="Downloading…"
            >
              <Download className="h-4 w-4" />
              Download PDF Report
            </Button>
          ) : null}
          {wordButton}
          <Button
            variant="outline"
            loading={retrying}
            onClick={retrySameExpert}
          >
            Retry research
          </Button>
          {inProgress ? (
            <Button
              variant="outline"
              loading={cancel.isPending}
              loadingText="Cancelling…"
              onClick={() => cancel.mutate()}
            >
              Cancel
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/ewi/histories">All Histories</Link>
          </Button>
          <Button
            variant="destructive"
            className="sm:ml-auto"
            loading={remove.isPending}
            loadingText="Deleting…"
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

      {downloadError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Download failed</AlertTitle>
          <AlertDescription>
            <p>{downloadError.message}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              loading={downloading || exportingWord}
              onClick={retryDownload}
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
              <Button onClick={retrySameExpert} loading={retrying}>
                Retry research
              </Button>
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
