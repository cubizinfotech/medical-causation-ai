"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import {
  EWI_DISPLAY_STAGES,
  type EwiStageUiStatus,
} from "@/features/ewi/progress-stages";

const STATUS_COPY: Record<EwiStageUiStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  unavailable: "Unavailable",
  restricted: "Restricted",
};

function StatusIcon({ status }: { status: EwiStageUiStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />;
    case "running":
      return (
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      );
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" aria-hidden />;
    case "unavailable":
      return (
        <MinusCircle className="h-5 w-5 text-amber-600" aria-hidden />
      );
    case "restricted":
      return <Lock className="h-5 w-5 text-amber-700" aria-hidden />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/50" aria-hidden />;
  }
}

function statusBadgeVariant(
  status: EwiStageUiStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "completed") return "default";
  if (status === "running") return "secondary";
  return "outline";
}

export function InvestigationTimeline({
  statuses,
  className,
}: {
  statuses: EwiStageUiStatus[];
  className?: string;
}) {
  return (
    <ol className={cn("space-y-3", className)} aria-label="Investigation stages">
      {EWI_DISPLAY_STAGES.map((stage, index) => {
        const status = statuses[index] ?? "pending";
        return (
          <li key={stage.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              <StatusIcon status={status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    status === "pending" && "text-muted-foreground",
                    status === "failed" && "text-destructive",
                  )}
                >
                  {stage.label}
                </p>
                <Badge variant={statusBadgeVariant(status)} className="text-[10px]">
                  {STATUS_COPY[status]}
                </Badge>
              </div>
              {status === "running" ? (
                <p className="text-xs text-muted-foreground">In progress…</p>
              ) : null}
              {status === "failed" ? (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  Stage failed — review details and retry if needed
                </p>
              ) : null}
              {status === "unavailable" ? (
                <p className="text-xs text-muted-foreground">
                  Source unavailable; investigation continued
                </p>
              ) : null}
              {status === "restricted" ? (
                <p className="text-xs text-muted-foreground">
                  Restricted source — metadata only
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
