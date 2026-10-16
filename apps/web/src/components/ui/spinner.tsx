import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The app's loading indicator. Buttons show it through `loading` (see
 * Button); use it directly for loading cards and lists.
 */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  /** Read by screen readers; omit when nearby text already says it. */
  label?: string;
}) {
  return (
    <Loader2
      data-spinner=""
      className={cn("h-4 w-4 shrink-0 animate-spin", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}
