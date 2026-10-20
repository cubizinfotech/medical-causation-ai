"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatElapsed } from "@/features/ewi/utils/format-elapsed";

interface ProcessingTimerProps {
  /** When the investigation was queued (ISO string from the server). */
  startedAt?: string | null;
  /** When it stopped. While this is empty the timer keeps counting. */
  endedAt?: string | null;
  /** True while the investigation is still running. */
  running: boolean;
}

/**
 * Shows how long an investigation has been processing. The start time comes
 * from the server, so the count survives a page refresh or a resume.
 */
export function ProcessingTimer({
  startedAt,
  endedAt,
  running,
}: ProcessingTimerProps) {
  const [localStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const parsedStart = startedAt ? Date.parse(startedAt) : Number.NaN;
  const start = Number.isNaN(parsedStart) ? localStart : parsedStart;
  const parsedEnd = endedAt ? Date.parse(endedAt) : Number.NaN;
  const end = !running && !Number.isNaN(parsedEnd) ? parsedEnd : now;
  const label = formatElapsed((end - start) / 1000);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      role="timer"
      aria-label={running ? "Time spent processing" : "Total processing time"}
    >
      <Timer className="size-4" aria-hidden="true" />
      <span>{running ? "Processing time" : "Total time"}</span>
      <span className="font-medium tabular-nums text-foreground">{label}</span>
    </span>
  );
}
