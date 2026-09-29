import { cn } from "@/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

export function Alert({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "warning";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variant === "default" && "border-border bg-card text-foreground",
        variant === "destructive" &&
          "border-destructive/40 bg-destructive/5 text-destructive",
        variant === "warning" &&
          "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100",
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-medium", className)} {...props} />;
}

export function AlertDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mt-1 text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
