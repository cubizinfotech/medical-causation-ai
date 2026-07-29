"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { LoadingCard, ProgressTimeline } from "@/components/demo";
import { MedicalReport } from "@/components/report/medical-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ANALYSIS_PROGRESS_STEPS } from "@/features/demo/constants";
import { useMedicalAnalysisJob } from "@/features/demo/hooks/use-medical-analysis-job";
import { medicalAnalysisClient } from "@/features/medical-analysis/medical-analysis.service";
import type { AnalysisHistoryDetail } from "@/features/medical-analysis/history.types";

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rem}s` : `${rem}s`;
}

function stepIndexFromJobStep(stepId: string | undefined): number {
  if (!stepId) return 0;
  const index = ANALYSIS_PROGRESS_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}

function isProcessing(status: AnalysisHistoryDetail["status"]): boolean {
  return status === "queued" || status === "running";
}

export default function HistoryDetailView({ id }: { id: string }) {
  const [history, setHistory] = useState<AnalysisHistoryDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const {
    job,
    error: jobError,
    resume,
    isRunning,
    isCompleted: jobCompleted,
    isFailed: jobFailed,
    isSubmitting,
  } = useMedicalAnalysisJob();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await medicalAnalysisClient.getHistory(id);
      setHistory(detail);
      return detail;
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load history";
      setLoadError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadHistory().then((detail) => {
      if (detail && isProcessing(detail.status)) {
        setStartedAt(Date.now());
        resume(detail.jobId);
      }
    });
  }, [loadHistory, resume]);

  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [isRunning, startedAt]);

  useEffect(() => {
    if (jobCompleted || jobFailed) {
      void loadHistory();
    }
  }, [jobCompleted, jobFailed, loadHistory]);

  const displayStatus = useMemo(() => {
    if (job?.status) return job.status;
    return history?.status ?? "queued";
  }, [history?.status, job?.status]);

  const isCompleted = displayStatus === "completed";
  const isFailed = displayStatus === "failed";
  const processing = isProcessing(displayStatus as AnalysisHistoryDetail["status"]);

  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (job?.progress != null) return job.progress;
    return history?.progress ?? 0;
  }, [history?.progress, isCompleted, job?.progress]);

  const currentStepIndex = useMemo(() => {
    if (isCompleted) return ANALYSIS_PROGRESS_STEPS.length;
    return stepIndexFromJobStep(job?.step ?? history?.step ?? undefined);
  }, [history?.step, isCompleted, job?.step]);

  const statusTitle = useMemo(() => {
    if (isCompleted) return "Analysis Complete";
    if (isFailed) return "Analysis Failed";
    if (isSubmitting) return "Connecting…";
    return (
      job?.stepLabel ??
      history?.stepLabel ??
      ANALYSIS_PROGRESS_STEPS[currentStepIndex]?.label ??
      "Processing"
    );
  }, [
    currentStepIndex,
    history?.stepLabel,
    isCompleted,
    isFailed,
    isSubmitting,
    job?.stepLabel,
  ]);

  const statusDescription = useMemo(() => {
    if (isCompleted) {
      return "This case finished successfully. The full report is below.";
    }
    if (isFailed) {
      return (
        jobError?.message ??
        job?.error ??
        history?.errorMessage ??
        "The analysis could not be completed."
      );
    }
    if (processing) {
      return (
        job?.message ??
        history?.message ??
        "Analysis is running in the background with live updates."
      );
    }
    return undefined;
  }, [
    history?.errorMessage,
    history?.message,
    isCompleted,
    isFailed,
    job?.error,
    job?.message,
    jobError?.message,
    processing,
  ]);

  const result = history?.result ?? job?.result ?? null;

  if (loading && !history) {
    return (
      <PageContainer className="py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
        Loading case history…
      </PageContainer>
    );
  }

  if (loadError || !history) {
    return (
      <PageContainer className="py-20">
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {loadError ?? "History not found"}
            </p>
            <Button variant="outline" asChild>
              <Link href="/histories">
                <ArrowLeft className="h-4 w-4" />
                Back to Histories
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-10">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/histories">
            <ArrowLeft className="h-4 w-4" />
            All Histories
          </Link>
        </Button>
        <Badge variant="secondary" className="mb-3">
          {processing
            ? "Background Processing"
            : isCompleted
              ? "Completed"
              : isFailed
                ? "Failed"
                : "Case Detail"}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          {history.patientName}
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {history.medicalQuestion}
        </p>
      </div>

      {processing || isFailed ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <LoadingCard
              title={statusTitle}
              description={statusDescription}
              progress={progressPercent}
            />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Overall Progress</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  {formatElapsed(elapsedMs)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progressPercent} />
                <p className="text-sm text-muted-foreground">
                  {processing
                    ? "Live updates via WebSocket and polling."
                    : "Processing stopped before completion."}
                </p>
              </CardContent>
            </Card>

            {isFailed ? (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
                  <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
                  <div className="flex-1 space-y-3">
                    <p className="font-semibold text-destructive">
                      Analysis failed
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {statusDescription}
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/case">
                        <RotateCcw className="h-4 w-4" />
                        Submit New Case
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="h-fit lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Processing Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressTimeline
                steps={[...ANALYSIS_PROGRESS_STEPS]}
                currentStepIndex={currentStepIndex}
                failed={isFailed}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isCompleted && result ? (
        <div className="space-y-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-start gap-4 p-6">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-primary">Report ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confidence score: {result.confidenceScore.score}% · Submitted{" "}
                  {new Date(history.createdAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <MedicalReport result={result} />
        </div>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Case Intake Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Age / Gender</p>
            <p>
              {history.patientAge} · {history.patientGender}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Accident Date</p>
            <p>{history.accidentDate}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Accident Type</p>
            <p>{history.accidentType}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Accident Description</p>
            <p className="whitespace-pre-wrap">{history.accidentDescription}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Diagnosis</p>
            <p>{history.diagnosis}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Symptoms</p>
            <p>{history.symptoms}</p>
          </div>
          {history.medicalHistory ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Medical History</p>
              <p className="whitespace-pre-wrap">{history.medicalHistory}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
