"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ewiClient, type ApiError } from "@/features/ewi/ewi.service";
import { ewiSocketUrl } from "@/lib/config/socket";
import type { ExpertInvestigationFormValues } from "@/features/ewi/schemas/expert-form.schema";
import type {
  CreateEwiJobResponse,
  EwiInvestigationJobRecord,
} from "@/features/ewi/types";

export type EwiJobPhase =
  | "idle"
  | "submitting"
  | "running"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 4000;

function isTerminal(status: EwiInvestigationJobRecord["status"]): boolean {
  return status === "completed" || status === "failed";
}

export function useEwiInvestigationJob() {
  const [phase, setPhase] = useState<EwiJobPhase>("idle");
  const [job, setJob] = useState<EwiInvestigationJobRecord | null>(null);
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

  const applyUpdate = useCallback((update: EwiInvestigationJobRecord) => {
    setJob(update);
    if (update.status === "completed") {
      setPhase("completed");
      setError(null);
    } else if (update.status === "failed") {
      setPhase("failed");
      setError(new Error(update.error ?? "Investigation failed"));
    } else if (update.status === "running" || update.status === "queued") {
      setPhase("running");
    }
  }, []);

  const startTracking = useCallback(
    (jobId: string) => {
      cleanup();
      activeJobIdRef.current = jobId;

      const socket = io(ewiSocketUrl(), {
        transports: ["websocket", "polling"],
        autoConnect: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("subscribe", { jobId });
      });

      socket.on("job:update", (update: EwiInvestigationJobRecord) => {
        if (update.jobId === jobId) {
          applyUpdate(update);
          if (isTerminal(update.status)) {
            cleanup();
          }
        }
      });

      pollRef.current = setInterval(() => {
        void ewiClient
          .getJob(jobId)
          .then((record) => {
            if (activeJobIdRef.current !== jobId) return;
            applyUpdate(record);
            if (isTerminal(record.status)) {
              cleanup();
            }
          })
          .catch(() => {
            /* polling is best-effort when socket is connected */
          });
      }, POLL_INTERVAL_MS);
    },
    [applyUpdate, cleanup],
  );

  const submit = useCallback(
    async (
      values: ExpertInvestigationFormValues,
    ): Promise<CreateEwiJobResponse> => {
      setPhase("submitting");
      setError(null);
      try {
        const created = await ewiClient.submitJob(values);
        setPhase("running");
        startTracking(created.jobId);
        return created;
      } catch (err) {
        setPhase("failed");
        const next =
          err instanceof Error
            ? err
            : new Error("Failed to submit investigation");
        setError(next);
        throw err as ApiError;
      }
    },
    [startTracking],
  );

  const resume = useCallback(
    (jobId: string) => {
      setPhase("running");
      setError(null);
      startTracking(jobId);
      void ewiClient.getJob(jobId).then(applyUpdate).catch((err: unknown) => {
        setPhase("failed");
        setError(
          err instanceof Error ? err : new Error("Unable to resume job"),
        );
      });
    },
    [applyUpdate, startTracking],
  );

  return { phase, job, error, submit, resume, cleanup };
}
