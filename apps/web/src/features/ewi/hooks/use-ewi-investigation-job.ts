"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ewiClient } from "@/features/ewi/ewi.service";
import { ewiKeys } from "@/features/ewi/query-keys";
import { getAccessToken } from "@/lib/config";
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
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function useEwiInvestigationJob() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ewiKeys.job(jobId ?? "none"),
    queryFn: () => ewiClient.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "pending" || status === "running") {
        return POLL_INTERVAL_MS;
      }
      return false;
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ExpertInvestigationFormValues) =>
      ewiClient.submitJob(values),
    onSuccess: (created) => {
      setJobId(created.jobId);
    },
  });

  useEffect(() => {
    if (!jobId) return;

    const socket: Socket = io(ewiSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      auth: { token: getAccessToken() ?? undefined },
    });

    socket.on("connect", () => {
      socket.emit("subscribe", { jobId });
    });

    socket.on("job:update", (update: EwiInvestigationJobRecord) => {
      if (update.jobId !== jobId) return;
      queryClient.setQueryData(ewiKeys.job(jobId), update);
      if (isTerminal(update.status)) {
        socket.disconnect();
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [jobId, queryClient]);

  const job = jobQuery.data ?? null;
  const status = job?.status;

  let phase: EwiJobPhase = "idle";
  if (status === "completed") {
    phase = "completed";
  } else if (status === "failed" || status === "cancelled") {
    phase = "failed";
  } else if (mutation.isPending && !job) {
    phase = "submitting";
  } else if ((mutation.isError || jobQuery.isError) && !job) {
    phase = "failed";
  } else if (jobId) {
    phase = "running";
  }

  const error =
    status === "failed" || status === "cancelled"
      ? new Error(
          job?.error ??
            (status === "cancelled"
              ? "Investigation cancelled"
              : "Investigation failed"),
        )
      : mutation.error instanceof Error
        ? mutation.error
        : jobQuery.error instanceof Error
          ? jobQuery.error
          : null;

  const submit = useCallback(
    async (
      values: ExpertInvestigationFormValues,
    ): Promise<CreateEwiJobResponse> => {
      setJobId(null);
      return mutation.mutateAsync(values);
    },
    [mutation],
  );

  const resume = useCallback(
    (nextJobId: string) => {
      mutation.reset();
      setJobId(nextJobId);
    },
    [mutation],
  );

  return { phase, job, error, submit, resume };
}
