"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { LoadingCard, ProgressTimeline } from "@/components/demo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ANALYSIS_PROGRESS_STEPS } from "@/features/demo/constants";
import { useMedicalAnalysisJob } from "@/features/demo/hooks/use-medical-analysis-job";
import {
  loadCaseForm,
  loadActiveAnalysis,
  saveActiveAnalysis,
  saveAnalysisResult,
} from "@/features/demo/storage/case-storage";
import type { CaseFormValues } from "@/features/demo/schemas/case-form.schema";

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

export default function AnalysisView() {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [caseData] = useState<CaseFormValues | null>(() => loadCaseForm());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const {
    job,
    error,
    submit,
    resume,
    reset,
    isSubmitting,
    isRunning,
    isCompleted,
    isFailed,
  } = useMedicalAnalysisJob();

  useEffect(() => {
    if (!caseData) {
      router.replace("/case");
    }
  }, [caseData, router]);

  const buildRequest = useCallback(() => {
    if (!caseData) return null;
    return {
      patientName: caseData.patientName,
      patientAge: caseData.patientAge,
      patientGender: caseData.patientGender,
      accidentDate: caseData.accidentDate,
      accidentType: caseData.accidentType,
      accidentDescription: caseData.accidentDescription,
      diagnosis: caseData.diagnosis,
      symptoms: caseData.symptoms,
      medicalHistory: caseData.medicalHistory,
      medications: caseData.medications,
      timeline: caseData.timeline,
      medicalQuestion: caseData.medicalQuestion,
    };
  }, [caseData]);

  const runAnalysis = useCallback(() => {
    const request = buildRequest();
    if (!request) return;
    reset();
    setStartedAt(Date.now());
    setElapsedMs(0);
    void submit(request).then((created) => {
      saveActiveAnalysis({ caseId: created.caseId, jobId: created.jobId });
    });
  }, [buildRequest, reset, submit]);

  useEffect(() => {
    if (!caseData || hasStarted.current) return;
    hasStarted.current = true;

    const active = loadActiveAnalysis();
    if (active?.jobId) {
      setStartedAt(Date.now());
      resume(active.jobId);
      return;
    }

    runAnalysis();
  }, [caseData, resume, runAnalysis]);

  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [isRunning, startedAt]);

  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (isFailed) return job?.progress ?? 0;
    return job?.progress ?? (isSubmitting ? 5 : 8);
  }, [isCompleted, isFailed, isSubmitting, job?.progress]);

  const currentStepIndex = useMemo(() => {
    if (isCompleted) return ANALYSIS_PROGRESS_STEPS.length;
    return stepIndexFromJobStep(job?.step);
  }, [isCompleted, job?.step]);

  const statusTitle = useMemo(() => {
    if (isCompleted) return "Analysis Complete";
    if (isFailed) return "Analysis Failed";
    if (isSubmitting) return "Starting Analysis…";
    return job?.stepLabel ?? ANALYSIS_PROGRESS_STEPS[currentStepIndex]?.label ?? "Processing";
  }, [currentStepIndex, isCompleted, isFailed, isSubmitting, job?.stepLabel]);

  const statusDescription = useMemo(() => {
    if (isCompleted) {
      return "Your medical causation report is ready to review.";
    }
    if (isFailed) {
      return error?.message ?? job?.error ?? "The analysis could not be completed.";
    }
    if (isRunning) {
      return (
        job?.message ??
        "Analysis is running in the background. You can keep this page open — live updates arrive via WebSocket."
      );
    }
    return undefined;
  }, [error?.message, isCompleted, isFailed, isRunning, job?.error, job?.message]);

  const openReport = useCallback(() => {
    if (job?.result) {
      saveAnalysisResult(job.result);
      router.push("/report");
    }
  }, [job?.result, router]);

  if (!caseData) {
    return (
      <PageContainer className="py-20 text-center text-muted-foreground">
        Loading case…
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8">
        <Badge variant="secondary" className="mb-3">
          {isRunning ? "Background Processing" : isCompleted ? "Completed" : isFailed ? "Failed" : "AI Processing"}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Medical Causation Analysis
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Analyzing:{" "}
          <span className="font-medium text-foreground">
            {caseData.medicalQuestion}
          </span>
        </p>
        {job?.jobId ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Job ID: <span className="font-mono">{job.jobId}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <LoadingCard
            title={statusTitle}
            description={statusDescription}
            progress={progressPercent}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Overall Progress</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isRunning ? (
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
                {isRunning
                  ? "Long analyses run in the background (queue + live socket updates). No need to keep a single HTTP request open."
                  : isCompleted
                    ? "Processing finished successfully."
                    : isFailed
                      ? "Processing stopped before a report could be generated."
                      : "Waiting to start…"}
              </p>
            </CardContent>
          </Card>

          {isCompleted ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-primary">Success — analysis complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Confidence score: {job?.result?.confidenceScore.score ?? "—"}%
                      {job?.result?.metadata?.chunkCount
                        ? ` · ${job.result.metadata.chunkCount} knowledge-base chunks used`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={openReport}>View Report</Button>
                    <Button variant="outline" asChild>
                      <Link href="/case">New Case</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isFailed ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
                <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-destructive">Failed — analysis did not complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {error?.message ?? job?.error ?? "An unexpected error occurred."}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Common causes: OpenRouter free-tier rate limits, invalid JSON from the LLM, or Redis not running (`npm run docker:infra`).
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => runAnalysis()}>
                      <RotateCcw className="h-4 w-4" />
                      Retry Analysis
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/case">Edit Case</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Processing Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressTimeline
              steps={[...ANALYSIS_PROGRESS_STEPS]}
              currentStepIndex={currentStepIndex}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
