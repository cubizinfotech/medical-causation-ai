"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageContainer } from "@/components/layout";
import { ProgressTimeline } from "@/components/demo";
import { EWI_PROGRESS_STEPS } from "@/features/ewi/constants";
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

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const expert = loadExpertForm();
    if (!expert) {
      router.replace("/ewi/intake");
      return;
    }

    const existing = loadActiveEwiJob();
    if (existing?.jobId) {
      resume(existing.jobId);
      return;
    }

    void submit(expert)
      .then((created) => {
        saveActiveEwiJob(created);
      })
      .catch(() => {
        /* error surfaced via hook state */
      });
  }, [resume, router, submit]);

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

  return (
    <PageContainer className="py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Expert Witness Investigation
          </h1>
          <p className="mt-2 text-muted-foreground">
            Researching credentials, publications, legal history, and building a
            Word report with 100+ cross-examination questions.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {job?.stepLabel ?? "Starting…"}
            </span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
          {job?.message && (
            <p className="text-sm text-muted-foreground">{job.message}</p>
          )}
        </div>

        <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border p-4">
          <ProgressTimeline
            steps={EWI_PROGRESS_STEPS.map((s) => ({ id: s.id, label: s.label }))}
            currentStepIndex={Math.max(
              0,
              EWI_PROGRESS_STEPS.findIndex((s) => s.id === job?.step),
            )}
            failed={phase === "failed"}
          />
        </div>

        {phase === "failed" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">Investigation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message ?? "Unknown error"}
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline">
                <Link href="/ewi/intake">Edit Intake</Link>
              </Button>
              <Button
                onClick={() => {
                  clearActiveEwiJob();
                  startedRef.current = false;
                  router.refresh();
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
