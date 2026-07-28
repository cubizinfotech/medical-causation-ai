import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ProgressStep {
  id: string;
  label: string;
}

interface ProgressTimelineProps {
  steps: ProgressStep[];
  currentStepIndex: number;
  className?: string;
}

export function ProgressTimeline({
  steps,
  currentStepIndex,
  className,
}: ProgressTimelineProps) {
  return (
    <ol className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const isComplete = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isPending = index > currentStepIndex;

        return (
          <li key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
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
                )}
              >
                {step.label}
              </p>
              {isCurrent ? (
                <p className="text-xs text-muted-foreground">In progress…</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
