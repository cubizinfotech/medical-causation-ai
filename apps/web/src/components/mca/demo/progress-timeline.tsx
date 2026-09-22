import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ProgressStep {
  id: string;
  label: string;
}

interface ProgressTimelineProps {
  steps: ProgressStep[];
  currentStepIndex: number;
  failed?: boolean;
  className?: string;
}

export function ProgressTimeline({
  steps,
  currentStepIndex,
  failed = false,
  className,
}: ProgressTimelineProps) {
  return (
    <ol className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const isComplete = !failed && index < currentStepIndex;
        const isFailedStep = failed && index === currentStepIndex;
        const isCurrent = !failed && index === currentStepIndex;
        const isPending = index > currentStepIndex;

        return (
          <li key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : isFailedStep ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : isCurrent ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  isPending && "text-muted-foreground",
                  isCurrent && "text-foreground",
                  isComplete && "text-foreground",
                  isFailedStep && "text-destructive",
                )}
              >
                {step.label}
              </p>
              {isCurrent ? (
                <p className="text-xs text-muted-foreground">In progress…</p>
              ) : null}
              {isFailedStep ? (
                <p className="text-xs text-destructive">Failed here</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
