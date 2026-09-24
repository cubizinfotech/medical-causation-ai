"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { LoadingCard, ProgressTimeline } from "@/components/demo";
import { EWI_DISPLAY_STAGES, timelineIndex, displayStageLabel } from "@/features/ewi/progress-stages";
import { useEwiInvestigationJob } from "@/features/ewi/hooks/use-ewi-investigation-job";
import {
  clearActiveEwiJob,
  loadActiveEwiJob,
  loadExpertForm,
  saveActiveEwiJob,
} from "@/features/ewi/storage/ewi-storage";

export default function EwiInvestigationView() {
  const router = useRouter();
  const { phase, job, error, submit, resume } = useEwiInvestigationJob();
  const startedRef = useRef(false);
  const submitRef = useRef(submit);
  const resumeRef = useRef(resume);
  const expert = loadExpertForm();

  useEffect(() => {
    submitRef.current = submit;
    resumeRef.current = resume;
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const saved = loadExpertForm();
    if (!saved) {
      router.replace("/ewi/intake");
      return;
    }

    const existing = loadActiveEwiJob();
    if (existing?.jobId) {
      resumeRef.current(existing.jobId);
      return;
    }

    void submitRef
      .current(saved)
      .then((created) => {
        saveActiveEwiJob(created);
      })
      .catch(() => {
        /* error surfaced via hook state */
      });
  }, [router]);

  useEffect(() => {
    if (phase !== "completed" || !job) return;
    clearActiveEwiJob();
    const investigationId = job.investigationId;
    if (investigationId) {
      router.push(`/ewi/histories/${investigationId}`);
      return;
    }
    router.push("/ewi/histories");
  }, [phase, job, router]);

  const progress = job?.progress ?? (phase === "submitting" ? 5 : 0);
  const stageLabel = job ? displayStageLabel(job.step) : "Identifying Expert";
  const statusLabel = job?.status ?? (phase === "submitting" ? "starting" : "pending");
  const failed = phase === "failed";

  const retry = () => {
    const saved = loadExpertForm();
    if (!saved) {
      router.push("/ewi/intake");
      return;
    }
    clearActiveEwiJob();
    void submit(saved)
      .then((created) => {
        saveActiveEwiJob(created);
      })
      .catch(() => {
        /* error surfaced via hook state */
      });
  };

  return (
    <PageContainer className="py-10">
      <div className="mb-8">
        <Badge variant="secondary">Expert Witness Investigation</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {expert ? expert.expertName : "Investigation"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {expert
            ? `${expert.specialty}. Research runs automatically. Unavailable sources are recorded and the investigation continues.`
            : "Researching credentials, publications, and legal history."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <LoadingCard
            title={stageLabel}
            description={job?.message ?? "Starting the investigation…"}
            progress={progress}
          />
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{statusLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Overall progress</p>
                <p className="font-medium">{progress}%</p>
              </div>
            </CardContent>
          </Card>

          {failed ? (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Investigation failed
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {error?.message ?? "Unknown error"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={retry}>Retry</Button>
                  <Button asChild variant="outline">
                    <Link href="/ewi/intake">Edit Intake</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

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
                currentStepIndex={timelineIndex(job?.step, job?.status)}
                failed={failed}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
