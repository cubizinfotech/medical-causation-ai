"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout";
import { InvestigationTimeline } from "@/components/ewi/investigation-timeline";
import { InvestigationResults } from "@/components/ewi/investigation-results";
import {
  displayStageLabel,
  resolveStageStatuses,
} from "@/features/ewi/progress-stages";
import { useEwiInvestigationJob } from "@/features/ewi/hooks/use-ewi-investigation-job";
import {
  clearActiveEwiJob,
  loadActiveEwiJob,
  loadExpertForm,
  saveActiveEwiJob,
} from "@/features/ewi/storage/ewi-storage";
import { toUserFacingError } from "@/features/ewi/utils/user-facing-error";
import type { ExpertInvestigationFormValues } from "@/features/ewi/schemas/expert-form.schema";

export default function EwiInvestigationView() {
  const router = useRouter();
  const {
    phase,
    job,
    error,
    submit,
    resume,
    cancel,
    isCancelling,
    investigationId,
  } = useEwiInvestigationJob();
  const startedRef = useRef(false);
  const submitRef = useRef(submit);
  const resumeRef = useRef(resume);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [stayOnPage, setStayOnPage] = useState(false);
  const [expert, setExpert] = useState<ExpertInvestigationFormValues | null>(
    null,
  );
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    submitRef.current = submit;
    resumeRef.current = resume;
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const saved = loadExpertForm();
    const existing = loadActiveEwiJob();
    if (saved) setExpert(saved);

    if (!saved && !existing?.jobId) {
      router.replace("/ewi/intake");
      return;
    }

    if (existing?.jobId) {
      resumeRef.current(existing.jobId, existing.investigationId);
      queueMicrotask(() => setBootstrapped(true));
      return;
    }

    if (!saved) {
      router.replace("/ewi/intake");
      return;
    }

    void submitRef
      .current(saved)
      .then((created) => {
        saveActiveEwiJob(created);
        setBootstrapped(true);
      })
      .catch(() => {
        setBootstrapped(true);
      });
  }, [router]);

  useEffect(() => {
    if (phase !== "completed" || !job || stayOnPage) return;
    clearActiveEwiJob();
    const id = job.investigationId ?? investigationId;
    if (id) {
      router.push(`/ewi/histories/${id}`);
      return;
    }
    router.push("/ewi/histories");
  }, [phase, job, router, stayOnPage, investigationId]);

  const progress = job?.progress ?? (phase === "submitting" ? 5 : 0);
  const stageLabel = job
    ? displayStageLabel(job.step)
    : "Expert Identification";
  const statusLabel =
    job?.status ?? (phase === "submitting" ? "starting" : "pending");
  const failed = phase === "failed";
  const running = phase === "running" || phase === "submitting";
  const stageStatuses = resolveStageStatuses({
    currentStep: job?.step,
    jobStatus:
      job?.status ?? (running ? "running" : failed ? "failed" : null),
    sourceStatuses: job?.result?.sourceStatuses,
  });

  const retry = () => {
    const saved = loadExpertForm() ?? expert;
    if (!saved) {
      router.push("/ewi/intake");
      return;
    }
    setCancelError(null);
    setStayOnPage(false);
    setExpert(saved);
    clearActiveEwiJob();
    void submit(saved)
      .then((created) => {
        saveActiveEwiJob(created);
      })
      .catch(() => {
        /* error surfaced via hook state */
      });
  };

  const onCancel = async () => {
    setCancelError(null);
    try {
      await cancel();
      clearActiveEwiJob();
      setStayOnPage(true);
    } catch (err) {
      setCancelError(
        toUserFacingError(err, "Unable to cancel this investigation."),
      );
    }
  };

  if (!bootstrapped && !failed && phase === "idle") {
    return (
      <PageContainer className="py-10">
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Starting investigation"
        >
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-10">
      <div className="mb-8">
        <Badge variant="secondary">Expert Witness Investigation</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {expert ? expert.expertName : "Investigation Progress"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {expert
            ? `${expert.city} · ${expert.specialty}. Research runs automatically. Unavailable sources are recorded and the investigation continues.`
            : "Researching credentials, publications, and legal history."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{stageLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {job?.message ??
                  (phase === "submitting"
                    ? "Submitting investigation…"
                    : "Waiting for the first research stage…")}
              </p>
              <Progress value={progress} aria-label="Investigation progress" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-medium capitalize">{statusLabel}</span>
                </p>
                <p className="font-medium tabular-nums">{progress}%</p>
              </div>
              {running ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={isCancelling || !investigationId}
                    onClick={() => void onCancel()}
                  >
                    {isCancelling ? "Cancelling…" : "Cancel investigation"}
                  </Button>
                  {investigationId ? (
                    <Button asChild variant="ghost">
                      <Link href={`/ewi/histories/${investigationId}`}>
                        Open history page
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {!job && running ? (
            <Card>
              <CardContent className="space-y-3 py-6" aria-busy="true">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ) : null}

          {cancelError ? (
            <Alert variant="destructive">
              <AlertTitle>Cancel failed</AlertTitle>
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          ) : null}

          {failed ? (
            <Alert variant="destructive">
              <AlertTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden />
                {job?.status === "cancelled"
                  ? "Investigation cancelled"
                  : "Investigation failed"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  {toUserFacingError(
                    error,
                    "The investigation did not finish. You can retry or review any partial results below.",
                  )}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button onClick={retry}>Retry investigation</Button>
                  <Button asChild variant="outline">
                    <Link href="/ewi/intake">Edit intake</Link>
                  </Button>
                  {investigationId ? (
                    <Button asChild variant="ghost">
                      <Link href={`/ewi/histories/${investigationId}`}>
                        View saved record
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {phase === "completed" && stayOnPage && job?.result ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Investigation completed</AlertTitle>
                <AlertDescription>
                  <p>
                    Results are ready. You can download the report from the
                    history page.
                  </p>
                  <div className="mt-3">
                    <Button asChild>
                      <Link
                        href={
                          investigationId
                            ? `/ewi/histories/${investigationId}`
                            : "/ewi/histories"
                        }
                      >
                        View full results
                      </Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
              <InvestigationResults
                summary={job.result.summary ?? null}
                result={job.result}
              />
            </div>
          ) : null}

          {failed && job?.result ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Partial results collected before failure
              </p>
              <InvestigationResults
                summary={job.result.summary ?? null}
                result={job.result}
              />
            </div>
          ) : null}
        </div>

        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Investigation stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[40rem] overflow-y-auto pr-1">
              <InvestigationTimeline statuses={stageStatuses} />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
