"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

export type DateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/** Text-based date field (YYYY-MM-DD) — avoids native browser date picker UI. */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, placeholder = "YYYY-MM-DD", ...props }, ref) => (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={cn("pr-10 font-mono tracking-tight", className)}
        {...props}
      />
      <Calendar
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  ),
);
DateInput.displayName = "DateInput";
