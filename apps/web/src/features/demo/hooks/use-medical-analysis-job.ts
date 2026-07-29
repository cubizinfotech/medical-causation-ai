"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  medicalAnalysisClient,
  type ApiError,
} from "@/features/medical-analysis/medical-analysis.service";
import { medicalAnalysisSocketUrl } from "@/lib/config/socket";
import type { AnalyzeCaseRequest } from "@/features/medical-analysis/types";
import type {
  CreateMedicalAnalysisJobResponse,
  MedicalAnalysisJobRecord,
  MedicalAnalysisJobUpdate,
} from "@/features/medical-analysis/job.types";

export type AnalysisJobPhase =
  | "idle"
  | "submitting"
  | "running"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 4000;

function isTerminal(status: MedicalAnalysisJobRecord["status"]): boolean {
  return status === "completed" || status === "failed";
}

export function useMedicalAnalysisJob() {
  const [phase, setPhase] = useState<AnalysisJobPhase>("idle");
  const [job, setJob] = useState<MedicalAnalysisJobRecord | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    activeJobIdRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const applyUpdate = useCallback((update: MedicalAnalysisJobUpdate) => {
    setJob((current) => ({
      ...(current ?? {
        jobId: update.jobId,
        createdAt: update.updatedAt,
      }),
      ...update,
      jobId: update.jobId,
      status: update.status,
      step: update.step,
      stepLabel: update.stepLabel,
      progress: update.progress,
      message: update.message,
      error: update.error,
      result: update.result,
      updatedAt: update.updatedAt,
      completedAt: update.completedAt,
    }));

    if (update.status === "completed") {
      setPhase("completed");
      setError(null);
    } else if (update.status === "failed") {
      setPhase("failed");
      setError(new Error(update.error ?? "Analysis failed"));
    } else if (update.status === "running" || update.status === "queued") {
      setPhase("running");
    }
  }, []);

  const startTracking = useCallback(
    (jobId: string) => {
      cleanup();
      activeJobIdRef.current = jobId;

      const socket = io(medicalAnalysisSocketUrl(), {
        transports: ["websocket", "polling"],
        autoConnect: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("subscribe", { jobId });
      });

      socket.on("job:update", (update: MedicalAnalysisJobUpdate) => {
        if (update.jobId === jobId) {
          applyUpdate(update);
        }
      });

      void medicalAnalysisClient
        .getJob(jobId)
        .then(applyUpdate)
        .catch((fetchError: unknown) => {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load job status";
          setError(new Error(message));
        });

      pollRef.current = setInterval(() => {
        void medicalAnalysisClient
          .getJob(jobId)
          .then((record) => {
            applyUpdate(record);
            if (isTerminal(record.status) && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          })
          .catch(() => {
            // Polling is a fallback; socket may still deliver updates.
          });
      }, POLL_INTERVAL_MS);
    },
    [applyUpdate, cleanup],
  );

  const submit = useCallback(
    async (request: AnalyzeCaseRequest) => {
      setError(null);
      setJob(null);
      setPhase("submitting");

      try {
        const created = await medicalAnalysisClient.submitJob(request);
        setPhase("running");
        startTracking(created.jobId);
        return created;
      } catch (submitError) {
        const apiError =
          submitError instanceof Error
            ? submitError
            : new Error("Failed to start analysis");
        setError(apiError);
        setPhase("failed");
        throw apiError;
      }
    },
    [startTracking],
  );

  const resume = useCallback(
    (jobId: string) => {
      setError(null);
      setPhase("running");
      startTracking(jobId);
    },
    [startTracking],
  );

  const reset = useCallback(() => {
    cleanup();
    setJob(null);
    setError(null);
    setPhase("idle");
  }, [cleanup]);

  return {
    phase,
    job,
    error: error as ApiError | Error | null,
    submit,
    resume,
    reset,
    isSubmitting: phase === "submitting",
    isRunning: phase === "submitting" || phase === "running",
    isCompleted: phase === "completed",
    isFailed: phase === "failed",
  };
}
