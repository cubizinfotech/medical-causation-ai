"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { LoadingCard, ProgressTimeline } from "@/components/demo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ANALYSIS_PROGRESS_STEPS } from "@/features/demo/constants";
import { useMedicalAnalysis } from "@/features/demo/hooks/use-medical-analysis";
import {
  loadCaseForm,
  saveAnalysisResult,
} from "@/features/demo/storage/case-storage";
import type { CaseFormValues } from "@/features/demo/schemas/case-form.schema";

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rem}s` : `${rem}s`;
}

export default function AnalysisView() {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [caseData] = useState<CaseFormValues | null>(() => loadCaseForm());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const analysis = useMedicalAnalysis();

  useEffect(() => {
    if (!caseData) {
      router.replace("/case");
    }
  }, [caseData, router]);

  const runAnalysis = useCallback(() => {
    if (!caseData) return;
    setStartedAt(Date.now());
    setElapsedMs(0);
    analysis.mutate({
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
    });
  }, [analysis, caseData]);

  useEffect(() => {
    if (!caseData || hasStarted.current) return;
    hasStarted.current = true;
    runAnalysis();
  }, [caseData, runAnalysis]);

  useEffect(() => {
    if (!analysis.isPending || !startedAt) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [analysis.isPending, startedAt]);

  useEffect(() => {
    if (analysis.isSuccess && analysis.data) {
      saveAnalysisResult(analysis.data);
      router.push("/report");
    }
  }, [analysis.isSuccess, analysis.data, router]);

  const progressPercent = useMemo(() => {
    if (analysis.isSuccess) return 100;
    if (analysis.isError) return 0;
    const stepDuration = 2800;
    const maxBeforeComplete = 92;
    const estimated = Math.min(
      maxBeforeComplete,
      (elapsedMs / stepDuration) * (100 / ANALYSIS_PROGRESS_STEPS.length),
    );
    return estimated;
  }, [analysis.isSuccess, analysis.isError, elapsedMs]);

  const currentStepIndex = useMemo(() => {
    if (analysis.isSuccess) return ANALYSIS_PROGRESS_STEPS.length;
    const stepDuration = 2800;
    return Math.min(
      ANALYSIS_PROGRESS_STEPS.length - 1,
      Math.floor(elapsedMs / stepDuration),
    );
  }, [analysis.isSuccess, elapsedMs]);

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
          AI Processing
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
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <LoadingCard
            title={
              analysis.isSuccess
                ? "Analysis Complete"
                : analysis.isError
                  ? "Analysis Interrupted"
                  : (ANALYSIS_PROGRESS_STEPS[currentStepIndex]?.label ??
                    "Processing")
            }
            description={
              analysis.isPending
                ? "Searching private knowledge base and public medical literature, then generating your report…"
                : undefined
            }
            progress={progressPercent}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Overall Progress</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatElapsed(elapsedMs)}
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercent} />
            </CardContent>
          </Card>

          {analysis.isSuccess ? (
            <Card className="border-primary/30">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Analysis complete — opening your report…
              </CardContent>
            </Card>
          ) : null}

          {analysis.isError ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {analysis.error.message}
                  </p>
                  <div className="mt-4 flex gap-3">
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
